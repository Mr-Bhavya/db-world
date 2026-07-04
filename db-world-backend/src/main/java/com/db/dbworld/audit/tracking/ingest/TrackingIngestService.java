package com.db.dbworld.audit.tracking.ingest;

import com.db.dbworld.audit.tracking.aggregate.NginxTickAggregate;
import com.db.dbworld.audit.tracking.aggregate.TrackEvent;
import com.db.dbworld.audit.tracking.config.TrackingProperties;
import com.db.dbworld.audit.tracking.enums.ActivityKind;
import com.db.dbworld.audit.tracking.enums.TrackEventType;
import com.db.dbworld.audit.tracking.enums.TrackSource;
import com.db.dbworld.audit.tracking.parse.ClientAppDetector;
import com.db.dbworld.audit.tracking.repository.ActivityEventRepository;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Log4j2
@Service
@RequiredArgsConstructor
public class TrackingIngestService {

    private final ActivityEventRepository eventRepo;
    private final TrackingSessionWriter writer;
    private final TrackingProperties props;
    private final UserService userService;

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

    /**
     * Emits a server-authoritative RESOLVE event for a {@code /api/stream/resolve} call.
     *
     * <p>Runs async and swallows every exception — a tracking failure (bad user lookup,
     * null field, DB hiccup) must never affect the resolve response or the live streaming
     * path that depends on it. This is best-effort telemetry only.
     */
    @Async
    public void recordResolve(String userEmail, boolean inline, String requestId, String mediaFileId,
                               Long recordId, Integer seasonNumber, Integer episodeNumber,
                               String filePath, String fileName, Long fileSize,
                               String remoteAddr, String userAgent) {
        try {
            if (userEmail == null || requestId == null) {
                log.debug("recordResolve skipped: userEmail or requestId null (user={}, requestId={})",
                        userEmail, requestId);
                return;
            }

            UserEntity user;
            try {
                user = userService.getUserEntityByEmail(userEmail);
            } catch (Exception ex) {
                log.warn("recordResolve: user lookup failed for {}: {}", userEmail, ex.getMessage());
                return;
            }
            if (user == null) {
                log.warn("recordResolve: user not found: {}", userEmail);
                return;
            }

            var clientApp = ClientAppDetector.detect(userAgent);

            TrackEvent event = TrackEvent.builder()
                    .sessionId(requestId)
                    .activity(inline ? ActivityKind.STREAM : ActivityKind.DOWNLOAD)
                    .type(TrackEventType.RESOLVE)
                    .source(TrackSource.SERVER)
                    .clientApp(clientApp)
                    .channel(ClientAppDetector.channel(clientApp, false))
                    .eventTime(Instant.now())
                    .userId(user.getUserId())
                    .mediaFileId(mediaFileId)
                    .recordId(recordId)
                    .seasonNumber(seasonNumber)
                    .episodeNumber(episodeNumber)
                    .filePath(filePath)
                    .fileName(fileName)
                    .fileSize(fileSize)
                    .remoteAddr(remoteAddr)
                    .userAgent(userAgent)
                    .build();

            this.ingest(event);
        } catch (Exception e) {
            log.warn("recordResolve failed for user={}, requestId={}: {}", userEmail, requestId, e.getMessage());
        }
    }
}
