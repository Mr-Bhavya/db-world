package com.db.dbworld.audit.tracking.ingest;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.audit.tracking.aggregate.TrackEvent;
import com.db.dbworld.audit.tracking.enums.ActivityKind;
import com.db.dbworld.audit.tracking.enums.ClientApp;
import com.db.dbworld.audit.tracking.enums.TrackChannel;
import com.db.dbworld.audit.tracking.enums.TrackEventType;
import com.db.dbworld.audit.tracking.enums.TrackSource;
import com.db.dbworld.audit.tracking.ingest.dto.TrackBatchRequest;
import com.db.dbworld.audit.tracking.ingest.dto.TrackEventRequest;
import com.db.dbworld.core.context.UserContext;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Client event-ingest endpoint. App + web clients POST their own lifecycle events here
 * (download/stream/search progress, resolve acks, errors, etc). Authenticated but not
 * admin-gated — any logged-in user may post events for their own session; {@code userId}
 * is always resolved from the JWT, never trusted from the request body.
 *
 * <p>Individual malformed events (unparseable {@code type}/{@code activity}/{@code clientApp})
 * are skipped rather than failing the whole batch — telemetry ingestion must never 500 on a
 * client bug.
 */
@Log4j2
@RestController
@RequestMapping("/api/track")
@RequiredArgsConstructor
public class TrackController {

    /** Hard cap on events accepted per batch call; excess events are dropped (not a 400). */
    private static final int MAX_BATCH_SIZE = 100;

    private final TrackingIngestService trackingIngestService;
    private final UserContext userContext;

    @PostMapping("/events")
    public ApiResponse<Map<String, Object>> ingest(
            @RequestBody TrackBatchRequest body,
            @RequestHeader(value = "X-DbWorld-Client", required = false) String clientHeader,
            HttpServletRequest request) {

        List<TrackEventRequest> events = body != null ? body.events() : null;
        if (events == null || events.isEmpty()) {
            return ApiResponse.success(Map.of("accepted", 0));
        }

        if (events.size() > MAX_BATCH_SIZE) {
            log.warn("track batch of {} exceeds cap {}, truncating", events.size(), MAX_BATCH_SIZE);
            events = events.subList(0, MAX_BATCH_SIZE);
        }

        Long userId = userContext.userId();
        TrackChannel channel = "app".equalsIgnoreCase(clientHeader) ? TrackChannel.APP : TrackChannel.WEB;
        String remoteAddr = getClientIp(request);
        String userAgent = request.getHeader("User-Agent");

        int accepted = 0;
        for (TrackEventRequest req : events) {
            TrackEvent event = toTrackEvent(req, userId, channel, remoteAddr, userAgent);
            if (event == null) continue;

            trackingIngestService.ingest(event);
            accepted++;
        }

        return ApiResponse.success(Map.of("accepted", accepted));
    }

    private TrackEvent toTrackEvent(TrackEventRequest req, Long userId, TrackChannel channel,
                                     String remoteAddr, String userAgent) {
        if (req == null) return null;

        ActivityKind activity = parseEnum(ActivityKind.class, req.activity());
        TrackEventType type = parseEnum(TrackEventType.class, req.type());
        if (activity == null || type == null) {
            log.debug("track event skipped: unparseable activity={} type={}", req.activity(), req.type());
            return null;
        }

        ClientApp clientApp = parseEnum(ClientApp.class, req.clientApp());

        return TrackEvent.builder()
                .clientEventId(req.clientEventId())
                .sessionId(req.sessionId())
                .activity(activity)
                .type(type)
                .channel(channel)
                .clientApp(clientApp)
                .source(TrackSource.CLIENT)
                .eventTime(req.occurredAt() != null ? req.occurredAt() : Instant.now())
                .userId(userId)
                .mediaFileId(req.mediaFileId())
                .recordId(req.recordId())
                .seasonNumber(req.seasonNumber())
                .episodeNumber(req.episodeNumber())
                .fileName(req.fileName())
                .fileSize(req.fileSize())
                .cumulativeBytes(req.cumulativeBytes())
                .speedBps(req.speedBps())
                .connections(req.connections())
                .positionMs(req.positionMs())
                .durationMs(req.durationMs())
                .completionPercent(req.completionPercent())
                .errorCode(req.errorCode())
                .errorMessage(req.errorMessage())
                .searchQuery(req.searchQuery())
                .resultCount(req.resultCount())
                .remoteAddr(remoteAddr)
                .userAgent(userAgent)
                .build();
    }

    private <E extends Enum<E>> E parseEnum(Class<E> enumType, String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Enum.valueOf(enumType, value.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            log.debug("track event: unrecognized {} value '{}'", enumType.getSimpleName(), value);
            return null;
        }
    }

    private String getClientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        String xri = req.getHeader("X-Real-IP");
        return (xri != null && !xri.isBlank()) ? xri : req.getRemoteAddr();
    }
}
