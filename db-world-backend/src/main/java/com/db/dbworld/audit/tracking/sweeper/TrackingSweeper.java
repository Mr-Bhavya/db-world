package com.db.dbworld.audit.tracking.sweeper;

import com.db.dbworld.audit.tracking.config.TrackingProperties;
import com.db.dbworld.audit.tracking.entity.ActivitySessionEntity;
import com.db.dbworld.audit.tracking.enums.ActivityKind;
import com.db.dbworld.audit.tracking.enums.SessionState;
import com.db.dbworld.audit.tracking.repository.ActivityEventRepository;
import com.db.dbworld.audit.tracking.repository.ActivitySessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Plan 1B maintenance jobs for the tracking engine:
 * <ul>
 *   <li>{@link #sweepStale()} — aborts DOWNLOAD/STREAM sessions that stopped receiving
 *       events past their respective timeouts (PAUSED is intentionally excluded — a
 *       paused download is a deliberate client state, not staleness).</li>
 *   <li>{@link #pruneOldEvents()} — deletes raw {@code ACTIVITY_EVENT} rows past the
 *       configured retention window.</li>
 * </ul>
 */
@Log4j2
@Component
@RequiredArgsConstructor
public class TrackingSweeper {

    private final TrackingProperties props;
    private final ActivitySessionRepository sessionRepo;
    private final ActivityEventRepository eventRepo;

    @Scheduled(fixedDelayString = "${dbworld.tracking.sweeper-tick-ms:60000}")
    public void sweepStale() {
        if (!props.isEnabled()) return;

        Instant now = Instant.now();
        // Query once using the shorter (stream) timeout so both kinds are captured;
        // the DOWNLOAD-specific cutoff is re-checked in Java below.
        List<ActivitySessionEntity> candidates = sessionRepo.findByStateInAndLastEventAtBefore(
                List.of(SessionState.RESOLVING, SessionState.ACTIVE),
                now.minus(Duration.ofMinutes(props.getStreamTimeoutMin())));

        int abortedCount = 0;
        for (ActivitySessionEntity session : candidates) {
            boolean shouldAbort = session.getActivity() == ActivityKind.STREAM
                    || (session.getActivity() == ActivityKind.DOWNLOAD
                        && session.getLastEventAt() != null
                        && session.getLastEventAt().isBefore(now.minus(Duration.ofMinutes(props.getDownloadTimeoutMin()))));
            if (!shouldAbort) continue;

            session.setState(SessionState.ABORTED);
            try {
                sessionRepo.save(session);
                abortedCount++;
            } catch (ObjectOptimisticLockingFailureException ex) {
                log.debug("TrackingSweeper: skipped session {} — concurrent writer won the race; " +
                        "next tick will re-evaluate", session.getSessionId(), ex);
            }
        }

        if (abortedCount > 0) {
            log.info("TrackingSweeper: aborted {} stale session(s) out of {} candidate(s)", abortedCount, candidates.size());
        }
    }

    @Scheduled(fixedDelayString = "${dbworld.tracking.event-retention-prune-ms:86400000}")
    @Transactional
    public void pruneOldEvents() {
        if (!props.isEnabled()) return;

        Instant cutoff = Instant.now().minus(Duration.ofDays(props.getEventRetentionDays()));
        long deleted = eventRepo.deleteByEventTimeBefore(cutoff);
        if (deleted > 0) {
            log.info("TrackingSweeper: pruned {} activity event(s) older than {}", deleted, cutoff);
        }
    }
}
