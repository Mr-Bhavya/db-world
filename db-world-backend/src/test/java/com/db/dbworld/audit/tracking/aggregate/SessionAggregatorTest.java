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
        // Union of [0,4999] and [2500,9999] covers the full 10,000-byte file -> COMPLETED,
        // driven purely by real coverage (sawComplete is false, as nginx always reports now).
        ActivitySessionEntity s = ActivitySessionEntity.builder()
                .sessionId("req-2").activity(ActivityKind.DOWNLOAD).state(SessionState.RESOLVING)
                .fileSize(10_000L).attemptCount(0).build();
        NginxTickAggregate tick = new NginxTickAggregate(
                "req-2", ActivityKind.DOWNLOAD,
                List.of(new long[]{0, 4999}, new long[]{2500, 9999}),  // overlap, union == 10_000
                12_000L,                 // transferred (incl. overlap retransmit)
                10_000L, 8, 2_000_000L, ClientApp.IDM, "9.9.9.9", "IDM/6", Instant.now(), false);
        agg.applyNginxTick(s, tick);
        assertThat(s.getUniqueBytes()).isEqualTo(10_000L);        // union, not 12000
        assertThat(s.getNginxTransferredBytes()).isEqualTo(12_000L);
        assertThat(s.getCompletionPercent().doubleValue()).isEqualTo(100.0);
        assertThat(s.getPeakConnections()).isEqualTo(8);
        assertThat(s.getState()).isEqualTo(SessionState.COMPLETED);
        assertThat(s.getClientApp()).isEqualTo("IDM");
    }

    @Test void nginxOnlySession_partialCoverage_staysActiveNotCompleted() {
        // Client disconnected early: delivered range [0,4999] on a 10,000-byte file ->
        // union coverage (5000) is under fileSize, so the session must stay ACTIVE at
        // 50%, not be marked COMPLETED (the old sawComplete-based heuristic used to
        // wrongly flip this to COMPLETED/100%).
        ActivitySessionEntity s = ActivitySessionEntity.builder()
                .sessionId("req-3").activity(ActivityKind.DOWNLOAD).state(SessionState.RESOLVING)
                .fileSize(10_000L).attemptCount(0).build();
        NginxTickAggregate tick = new NginxTickAggregate(
                "req-3", ActivityKind.DOWNLOAD,
                List.of(new long[]{0, 4999}),
                5000L,
                10_000L, 1, 1_000_000L, ClientApp.ARIA2, "9.9.9.8", "aria2/1.36", Instant.now(), false);
        agg.applyNginxTick(s, tick);
        assertThat(s.getUniqueBytes()).isEqualTo(5000L);
        assertThat(s.getCompletionPercent().doubleValue()).isEqualTo(50.0);
        assertThat(s.getState()).isEqualTo(SessionState.ACTIVE);
        assertThat(s.getCompletionPercent().doubleValue()).isLessThan(100.0);
    }

    @Test void nginxTick_realDownloaderOverridesResolveBrowserClientApp() {
        // Resolve happened in Chrome, but the actual bytes were pulled by 1DM (an
        // external downloader) — the nginx-observed client must win so the admin
        // console shows the real transferrer, not the browser that hit /resolve.
        ActivitySessionEntity s = ActivitySessionEntity.builder()
                .sessionId("req-4").activity(ActivityKind.DOWNLOAD).state(SessionState.RESOLVING)
                .fileSize(10_000L).attemptCount(0).hasClientEvents(false)
                .clientApp(ClientApp.CHROME.name()).channel(TrackChannel.BROWSER)
                .build();
        NginxTickAggregate tick = new NginxTickAggregate(
                "req-4", ActivityKind.DOWNLOAD,
                List.of(new long[]{0, 9999}),
                10_000L,
                10_000L, 1, 5_000_000L, ClientApp.ONEDM, "9.9.9.7", "1DM/13.0 (Android)", Instant.now(), false);
        agg.applyNginxTick(s, tick);
        assertThat(s.getClientApp()).isEqualTo(ClientApp.ONEDM.name());
        assertThat(s.getChannel()).isEqualTo(TrackChannel.EXTERNAL);
        assertThat(s.getState()).isEqualTo(SessionState.COMPLETED);
    }

    @Test void dualSource_clientAuthoritativeForCompletion_noDoubleCount() {
        // App session: client says 50%, nginx lines also arrive; completion stays client-driven.
        // The nginx tick reports a *different* clientApp (IDM) than the client (ARIA2) to prove
        // that when hasClientEvents is true, nginx must NOT override clientApp/channel — the
        // FIX-C "real transferrer wins" logic only applies to nginx-only sessions.
        ActivitySessionEntity s = agg.initFromResolve(base(TrackEventType.RESOLVE).build());
        agg.applyClientEvent(s, base(TrackEventType.START).build());
        agg.applyClientEvent(s, base(TrackEventType.PROGRESS).cumulativeBytes(5000L).build());
        NginxTickAggregate tick = new NginxTickAggregate(
                "req-1", ActivityKind.DOWNLOAD, List.of(new long[]{0, 4999}),
                5000L, 10_000L, 4, 1_000_000L, ClientApp.IDM, "1.1.1.1", "IDM/6",
                Instant.now(), false);
        agg.applyNginxTick(s, tick);
        assertThat(s.getHasClientEvents()).isTrue();
        assertThat(s.getCompletionPercent().doubleValue()).isEqualTo(50.0); // client wins
        assertThat(s.getNginxTransferredBytes()).isEqualTo(5000L);          // separate column
        assertThat(s.getClientBytes()).isEqualTo(5000L);                    // not summed
        assertThat(s.getClientApp()).isEqualTo(ClientApp.ARIA2.name());     // nginx does NOT override
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
