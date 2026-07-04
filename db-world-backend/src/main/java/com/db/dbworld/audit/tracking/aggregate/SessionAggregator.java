package com.db.dbworld.audit.tracking.aggregate;

import com.db.dbworld.audit.tracking.entity.ActivitySessionEntity;
import com.db.dbworld.audit.tracking.enums.*;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Pure state machine that folds events onto an ActivitySessionEntity. */
@Component
public class SessionAggregator {

    public ActivitySessionEntity initFromResolve(TrackEvent e) {
        return ActivitySessionEntity.builder()
                .sessionId(e.sessionId())
                .userId(e.userId())
                .activity(e.activity())
                .channel(e.channel())
                .clientApp(e.clientApp() != null ? e.clientApp().name() : null)
                .mediaFileId(e.mediaFileId())
                .recordId(e.recordId())
                .seasonNumber(e.seasonNumber())
                .episodeNumber(e.episodeNumber())
                .filePath(e.filePath())
                .fileName(e.fileName())
                .fileSize(e.fileSize())
                .state(SessionState.RESOLVING)
                .uniqueBytes(0L).clientBytes(0L).nginxTransferredBytes(0L)
                .peakConnections(0).attemptCount(0).pauseCount(0).resumeCount(0).failCount(0)
                .hasClientEvents(false)
                .startedAt(e.eventTime()).lastEventAt(e.eventTime())
                .remoteAddr(e.remoteAddr()).userAgent(e.userAgent())
                .rangeIntervals("")
                .build();
    }

    public void applyClientEvent(ActivitySessionEntity s, TrackEvent e) {
        s.setHasClientEvents(true);
        s.setLastEventAt(latest(s.getLastEventAt(), e.eventTime()));
        if (e.clientApp() != null) s.setClientApp(e.clientApp().name());
        if (e.channel() != null)   s.setChannel(e.channel());
        if (e.connections() != null) s.setPeakConnections(Math.max(nz(s.getPeakConnections()), e.connections()));
        if (e.speedBps() != null)   s.setMaxSpeedBps(Math.max(nzL(s.getMaxSpeedBps()), e.speedBps()));
        if (e.cumulativeBytes() != null) {
            s.setClientBytes(Math.max(nzL(s.getClientBytes()), e.cumulativeBytes()));
            recomputeClientCompletion(s);
        }
        if (e.positionMs() != null) s.setWatchPositionMs(e.positionMs());
        if (e.durationMs() != null) s.setWatchDurationMs(e.durationMs());

        switch (e.type()) {
            case START, STREAM_START -> { s.setAttemptCount(nz(s.getAttemptCount()) + 1); s.setState(SessionState.ACTIVE); }
            case RETRY               -> { s.setAttemptCount(nz(s.getAttemptCount()) + 1); s.setState(SessionState.ACTIVE); }
            case PROGRESS, STREAM_TICK, SEEK, RESUME -> {
                if (e.type() == TrackEventType.RESUME) s.setResumeCount(nz(s.getResumeCount()) + 1);
                s.setState(SessionState.ACTIVE);
            }
            case PAUSE, STREAM_PAUSE -> { s.setPauseCount(nz(s.getPauseCount()) + 1); s.setState(SessionState.PAUSED); }
            case FAIL -> {
                s.setFailCount(nz(s.getFailCount()) + 1);
                s.setLastErrorCode(e.errorCode()); s.setLastErrorMessage(e.errorMessage());
                s.setState(SessionState.FAILED);
            }
            // COMPLETE forces 100% by design, even if reported bytes are partial.
            case COMPLETE -> { s.setState(SessionState.COMPLETED); s.setCompletedAt(e.eventTime());
                               s.setCompletionPercent(BigDecimal.valueOf(100)); }
            case ABORT, STREAM_STOP -> { /* leave state; sweeper/close handles */ }
            case RESOLVE, SEARCH -> { /* no state transition */ }
        }
    }

    public void applyNginxTick(ActivitySessionEntity s, NginxTickAggregate t) {
        s.setLastEventAt(latest(s.getLastEventAt(), t.lastEventAt()));
        if (s.getActivity() == null) s.setActivity(t.activity());
        if (t.fileTotal() != null && s.getFileSize() == null) s.setFileSize(t.fileTotal());
        if (t.realIp() != null) s.setRemoteAddr(t.realIp());
        s.setNginxTransferredBytes(nzL(s.getNginxTransferredBytes()) + t.transferredBytes());
        s.setPeakConnections(Math.max(nz(s.getPeakConnections()), t.peakConnections()));
        if (t.maxSpeedBps() != null) s.setMaxSpeedBps(Math.max(nzL(s.getMaxSpeedBps()), t.maxSpeedBps()));

        // Union of delivered ranges -> unique bytes (authoritative when no client events).
        s.setRangeIntervals(RangeIntervals.add(s.getRangeIntervals(), t.deliveredRanges()));
        long covered = RangeIntervals.covered(s.getRangeIntervals());
        if (s.getFileSize() != null) covered = Math.min(covered, s.getFileSize());
        s.setUniqueBytes(covered);

        if (!Boolean.TRUE.equals(s.getHasClientEvents())) {
            // nginx is the authority for this session.
            if (s.getClientApp() == null || ClientApp.UNKNOWN.name().equals(s.getClientApp()))
                s.setClientApp(t.clientApp() != null ? t.clientApp().name() : null);
            recomputeNginxCompletion(s);
            if (s.getState() == SessionState.RESOLVING) s.setState(SessionState.ACTIVE);
            if (t.sawComplete() || (s.getFileSize() != null && covered >= s.getFileSize())) {
                s.setState(SessionState.COMPLETED);
                if (s.getCompletedAt() == null) s.setCompletedAt(t.lastEventAt());
                s.setCompletionPercent(BigDecimal.valueOf(100));
            }
        }
    }

    private void recomputeClientCompletion(ActivitySessionEntity s) {
        if (s.getFileSize() != null && s.getFileSize() > 0 && s.getClientBytes() != null) {
            s.setCompletionPercent(pct(s.getClientBytes(), s.getFileSize()));
        }
    }
    private void recomputeNginxCompletion(ActivitySessionEntity s) {
        if (s.getFileSize() != null && s.getFileSize() > 0 && s.getUniqueBytes() != null) {
            s.setCompletionPercent(pct(s.getUniqueBytes(), s.getFileSize()));
        }
    }
    private static BigDecimal pct(long num, long den) {
        return BigDecimal.valueOf(Math.min(num, den))
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(den), 2, RoundingMode.HALF_UP);
    }
    private static java.time.Instant latest(java.time.Instant a, java.time.Instant b) {
        if (a == null) return b; if (b == null) return a; return b.isAfter(a) ? b : a;
    }
    private static int  nz(Integer v)  { return v == null ? 0 : v; }
    private static long nzL(Long v)     { return v == null ? 0L : v; }
}
