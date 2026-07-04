package com.db.dbworld.audit.tracking.aggregate;

import com.db.dbworld.audit.tracking.entity.ActivitySessionEntity;
import com.db.dbworld.audit.tracking.enums.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class SessionAggregatorTest {

    private final SessionAggregator agg = new SessionAggregator();

    private TrackEvent.TrackEventBuilder base(TrackEventType t) {
        return TrackEvent.builder()
                .sessionId("req-1").activity(ActivityKind.DOWNLOAD).type(t)
                .channel(TrackChannel.APP).clientApp(ClientApp.ARIA2).source(TrackSource.CLIENT)
                .eventTime(Instant.parse("2026-07-04T10:00:00Z"))
                .userId(7L).mediaFileId("mf-1").recordId(3L).fileSize(10_000L);
    }

    @Test void initFromResolve_startsResolving() {
        ActivitySessionEntity s = agg.initFromResolve(base(TrackEventType.RESOLVE).build());
        assertThat(s.getSessionId()).isEqualTo("req-1");
        assertThat(s.getState()).isEqualTo(SessionState.RESOLVING);
        assertThat(s.getAttemptCount()).isEqualTo(0);
    }

    @Test void start_movesToActive_andCountsAttempt() {
        ActivitySessionEntity s = agg.initFromResolve(base(TrackEventType.RESOLVE).build());
        agg.applyClientEvent(s, base(TrackEventType.START).build());
        assertThat(s.getState()).isEqualTo(SessionState.ACTIVE);
        assertThat(s.getAttemptCount()).isEqualTo(1);
        assertThat(s.getHasClientEvents()).isTrue();
    }

    @Test void clientProgress_setsCompletionFromCumulativeBytes() {
        ActivitySessionEntity s = agg.initFromResolve(base(TrackEventType.RESOLVE).build());
        agg.applyClientEvent(s, base(TrackEventType.START).build());
        agg.applyClientEvent(s, base(TrackEventType.PROGRESS).cumulativeBytes(5000L)
                .speedBps(1_000_000L).connections(4).build());
        assertThat(s.getClientBytes()).isEqualTo(5000L);
        assertThat(s.getPeakConnections()).isEqualTo(4);
        assertThat(s.getMaxSpeedBps()).isEqualTo(1_000_000L);
        assertThat(s.getCompletionPercent().doubleValue()).isEqualTo(50.0);
    }

    @Test void pauseResume_countedAndStateChanges() {
        ActivitySessionEntity s = agg.initFromResolve(base(TrackEventType.RESOLVE).build());
        agg.applyClientEvent(s, base(TrackEventType.START).build());
        agg.applyClientEvent(s, base(TrackEventType.PAUSE).build());
        assertThat(s.getState()).isEqualTo(SessionState.PAUSED);
        assertThat(s.getPauseCount()).isEqualTo(1);
        agg.applyClientEvent(s, base(TrackEventType.RESUME).build());
        assertThat(s.getState()).isEqualTo(SessionState.ACTIVE);
        assertThat(s.getResumeCount()).isEqualTo(1);
    }

    @Test void failThenRetry_incrementsAttemptsAndFails() {
        ActivitySessionEntity s = agg.initFromResolve(base(TrackEventType.RESOLVE).build());
        agg.applyClientEvent(s, base(TrackEventType.START).build());
        agg.applyClientEvent(s, base(TrackEventType.FAIL).errorCode("NET").errorMessage("reset").build());
        assertThat(s.getState()).isEqualTo(SessionState.FAILED);
        assertThat(s.getFailCount()).isEqualTo(1);
        assertThat(s.getLastErrorCode()).isEqualTo("NET");
        agg.applyClientEvent(s, base(TrackEventType.RETRY).build());
        assertThat(s.getState()).isEqualTo(SessionState.ACTIVE);
        assertThat(s.getAttemptCount()).isEqualTo(2);   // START + RETRY
    }

    @Test void complete_setsCompletedAndTimestamp() {
        ActivitySessionEntity s = agg.initFromResolve(base(TrackEventType.RESOLVE).build());
        agg.applyClientEvent(s, base(TrackEventType.START).build());
        agg.applyClientEvent(s, base(TrackEventType.COMPLETE).cumulativeBytes(10_000L).build());
        assertThat(s.getState()).isEqualTo(SessionState.COMPLETED);
        assertThat(s.getCompletedAt()).isNotNull();
        assertThat(s.getCompletionPercent().doubleValue()).isEqualTo(100.0);
    }

    @Test void nginxOnlySession_usesIntervalUnionForCompletion() {
        // External download (IDM): no client events, only nginx.
        ActivitySessionEntity s = ActivitySessionEntity.builder()
                .sessionId("req-2").activity(ActivityKind.DOWNLOAD).state(SessionState.RESOLVING)
                .fileSize(10_000L).attemptCount(0).build();
        NginxTickAggregate tick = new NginxTickAggregate(
                "req-2", ActivityKind.DOWNLOAD,
                List.of(new long[]{0, 4999}, new long[]{2500, 9999}),  // overlap
                12_000L,                 // transferred (incl. overlap retransmit)
                10_000L, 8, 2_000_000L, ClientApp.IDM, "9.9.9.9", "IDM/6", Instant.now(), true);
        agg.applyNginxTick(s, tick);
        assertThat(s.getUniqueBytes()).isEqualTo(10_000L);        // union, not 12000
        assertThat(s.getNginxTransferredBytes()).isEqualTo(12_000L);
        assertThat(s.getCompletionPercent().doubleValue()).isEqualTo(100.0);
        assertThat(s.getPeakConnections()).isEqualTo(8);
        assertThat(s.getState()).isEqualTo(SessionState.COMPLETED);
        assertThat(s.getClientApp()).isEqualTo("IDM");
    }

    @Test void dualSource_clientAuthoritativeForCompletion_noDoubleCount() {
        // App session: client says 50%, nginx lines also arrive; completion stays client-driven.
        ActivitySessionEntity s = agg.initFromResolve(base(TrackEventType.RESOLVE).build());
        agg.applyClientEvent(s, base(TrackEventType.START).build());
        agg.applyClientEvent(s, base(TrackEventType.PROGRESS).cumulativeBytes(5000L).build());
        NginxTickAggregate tick = new NginxTickAggregate(
                "req-1", ActivityKind.DOWNLOAD, List.of(new long[]{0, 4999}),
                5000L, 10_000L, 4, 1_000_000L, ClientApp.ARIA2, "1.1.1.1", "aria2/1.36",
                Instant.now(), false);
        agg.applyNginxTick(s, tick);
        assertThat(s.getHasClientEvents()).isTrue();
        assertThat(s.getCompletionPercent().doubleValue()).isEqualTo(50.0); // client wins
        assertThat(s.getNginxTransferredBytes()).isEqualTo(5000L);          // separate column
        assertThat(s.getClientBytes()).isEqualTo(5000L);                    // not summed
    }

    @Test void streamTick_updatesWatchPosition() {
        TrackEvent.TrackEventBuilder sb = base(TrackEventType.RESOLVE)
                .activity(ActivityKind.STREAM).type(TrackEventType.RESOLVE);
        ActivitySessionEntity s = agg.initFromResolve(sb.build());
        agg.applyClientEvent(s, base(TrackEventType.STREAM_TICK).activity(ActivityKind.STREAM)
                .positionMs(61_000L).durationMs(5_400_000L).build());
        assertThat(s.getWatchPositionMs()).isEqualTo(61_000L);
        assertThat(s.getWatchDurationMs()).isEqualTo(5_400_000L);
        assertThat(s.getState()).isEqualTo(SessionState.ACTIVE);
    }
}
