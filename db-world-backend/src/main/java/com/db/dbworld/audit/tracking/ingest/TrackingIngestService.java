package com.db.dbworld.audit.tracking.ingest;

import com.db.dbworld.audit.tracking.aggregate.NginxTickAggregate;
import com.db.dbworld.audit.tracking.aggregate.SessionAggregator;
import com.db.dbworld.audit.tracking.aggregate.TrackEvent;
import com.db.dbworld.audit.tracking.config.TrackingProperties;
import com.db.dbworld.audit.tracking.entity.ActivitySessionEntity;
import com.db.dbworld.audit.tracking.enums.SessionState;
import com.db.dbworld.audit.tracking.enums.TrackEventType;
import com.db.dbworld.audit.tracking.repository.ActivityEventRepository;
import com.db.dbworld.audit.tracking.repository.ActivitySessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Log4j2
@Service
@RequiredArgsConstructor
public class TrackingIngestService {

    private final ActivityEventRepository eventRepo;
    private final ActivitySessionRepository sessionRepo;
    private final SessionAggregator aggregator;
    private final TrackingProperties props;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ingest(TrackEvent e) {
        if (!props.isEnabled() || e == null || e.sessionId() == null) return;

        if (e.clientEventId() != null
                && eventRepo.existsBySessionIdAndClientEventId(e.sessionId(), e.clientEventId())) {
            log.debug("tracking: duplicate event {}/{} ignored", e.sessionId(), e.clientEventId());
            return;
        }

        eventRepo.save(EventEntityMapper.toEntity(e));

        ActivitySessionEntity session = sessionRepo.findById(e.sessionId())
                .orElseGet(() -> aggregator.initFromResolve(e));
        if (e.type() != TrackEventType.RESOLVE) {
            aggregator.applyClientEvent(session, e);
        }
        sessionRepo.save(session);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ingestNginxTick(NginxTickAggregate tick) {
        if (!props.isEnabled() || tick == null || tick.sessionId() == null) return;
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
