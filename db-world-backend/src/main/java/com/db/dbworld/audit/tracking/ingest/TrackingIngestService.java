package com.db.dbworld.audit.tracking.ingest;

import com.db.dbworld.audit.tracking.aggregate.NginxTickAggregate;
import com.db.dbworld.audit.tracking.aggregate.TrackEvent;
import com.db.dbworld.audit.tracking.config.TrackingProperties;
import com.db.dbworld.audit.tracking.repository.ActivityEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

@Log4j2
@Service
@RequiredArgsConstructor
public class TrackingIngestService {

    private final ActivityEventRepository eventRepo;
    private final TrackingSessionWriter writer;
    private final TrackingProperties props;

    public void ingest(TrackEvent e) {
        if (!props.isEnabled() || e == null || e.sessionId() == null) return;

        if (e.clientEventId() != null
                && eventRepo.existsBySessionIdAndClientEventId(e.sessionId(), e.clientEventId())) {
            log.debug("tracking: duplicate event {}/{} ignored", e.sessionId(), e.clientEventId());
            return;
        }

        OptimisticRetry.run(() -> writer.applyEvent(e));
    }

    public void ingestNginxTick(NginxTickAggregate tick) {
        if (!props.isEnabled() || tick == null || tick.sessionId() == null) return;
        OptimisticRetry.run(() -> writer.applyNginxTick(tick));
    }
}
