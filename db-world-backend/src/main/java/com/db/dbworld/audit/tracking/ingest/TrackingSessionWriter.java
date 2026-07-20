package com.db.dbworld.audit.tracking.ingest;

import com.db.dbworld.audit.tracking.aggregate.NginxTickAggregate;
import com.db.dbworld.audit.tracking.aggregate.SessionAggregator;
import com.db.dbworld.audit.tracking.aggregate.TrackEvent;
import com.db.dbworld.audit.tracking.entity.ActivitySessionEntity;
import com.db.dbworld.audit.tracking.enums.SessionState;
import com.db.dbworld.audit.tracking.enums.TrackEventType;
import com.db.dbworld.audit.tracking.repository.ActivityEventRepository;
import com.db.dbworld.audit.tracking.repository.ActivitySessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Owns the transactional load-modify-save unit for a single session row.
 *
 * <p>Split out from {@link TrackingIngestService} so {@link OptimisticRetry} retries against a
 * real Spring proxy: each retry attempt must open a brand-new {@code REQUIRES_NEW} transaction
 * (reloading the row and its current {@code row_version}), which self-invocation from within
 * the same bean would silently bypass.
 */
@Component
@RequiredArgsConstructor
public class TrackingSessionWriter {

    private final ActivityEventRepository eventRepo;
    private final ActivitySessionRepository sessionRepo;
    private final SessionAggregator aggregator;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void applyEvent(TrackEvent e) {
        eventRepo.save(EventEntityMapper.toEntity(e));

        ActivitySessionEntity session = sessionRepo.findById(e.sessionId())
                .orElseGet(() -> aggregator.initFromResolve(e));
        if (e.type() != TrackEventType.RESOLVE) {
            aggregator.applyClientEvent(session, e);
        }
        sessionRepo.save(session);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void applyNginxTick(NginxTickAggregate tick) {
        ActivitySessionEntity session = sessionRepo.findById(tick.sessionId())
                .orElseGet(() -> ActivitySessionEntity.builder()
                        .sessionId(tick.sessionId())
                        .activity(tick.activity())
                        .state(SessionState.RESOLVING)
                        .uniqueBytes(0L).clientBytes(0L).nginxTransferredBytes(0L)
                        .peakConnections(0).attemptCount(0).pauseCount(0).resumeCount(0).failCount(0)
                        .hasClientEvents(false).rangeIntervals("")
                        .startedAt(tick.lastEventAt()).lastEventAt(tick.lastEventAt())
                        .build());
        aggregator.applyNginxTick(session, tick);
        sessionRepo.save(session);
    }
}
