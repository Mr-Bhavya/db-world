package com.db.dbworld.app.admin.controller;

import com.db.dbworld.infrastructure.logging.LogsService;
import com.db.dbworld.infrastructure.logging.dto.LogFormat;
import com.db.dbworld.infrastructure.logging.dto.LogSource;
import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.config.AppConstants;
import jakarta.annotation.PreDestroy;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Log4j2
@RestController
@RequestMapping("/api/admin/logs")
@RequiredArgsConstructor
public class AdminLogsController {

    private final LogsService logsService;

    private final Map<String, SseEmitter> sseEmitters = new ConcurrentHashMap<>();
    private final Map<String, Thread> sseThreads = new ConcurrentHashMap<>();
    private final Map<String, ScheduledFuture<?>> sseHeartbeats = new ConcurrentHashMap<>();

    /**
     * Single-thread scheduler shared across all live SSE sessions for emitting
     * the periodic keep-alive comment. One thread is plenty — heartbeats are
     * cheap and at most a few admins watch logs at once.
     */
    private final ScheduledExecutorService heartbeatExec = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "logs-sse-heartbeat");
        t.setDaemon(true);
        return t;
    });

    /** Interval between SSE heartbeat comments. Must be shorter than nginx's
     *  default {@code proxy_read_timeout} (60s) and our SseEmitter timeout. */
    private static final long HEARTBEAT_INTERVAL_SECONDS = 15;

    // =====================================================================
    // SOURCES CONFIG
    // =====================================================================

    /**
     * Returns the full sources/subtypes configuration so the frontend
     * can build its UI without hardcoding anything.
     */
    @GetMapping("/sources")
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<ApiResponse<?>> getSources() {
        List<Map<String, Object>> sources = Arrays.stream(LogSource.values())
                .map(src -> {
                    List<Map<String, Object>> subTypes = src.getSubTypes().stream()
                            .map(st -> Map.<String, Object>of(
                                    "id", st,
                                    "label", st.toUpperCase().replace("_", " "),
                                    "supportsJson", src.isSupportsJson(),
                                    "supportsHistory", src.isSupportsHistory()
                            ))
                            .collect(Collectors.toList());

                    return Map.<String, Object>of(
                            "id", src.name().toLowerCase(),
                            "label", formatSourceLabel(src),
                            "supportsJson", src.isSupportsJson(),
                            "supportsHistory", src.isSupportsHistory(),
                            "subTypes", subTypes
                    );
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(sources));
    }

    // =====================================================================
    // QUERY LOGS
    // =====================================================================

    /**
     * Fetch logs for a source/type.
     * <ul>
     *   <li>{@code date} (YYYY-MM-DD) â€” historical day from rotated archives; omit for live/today.</li>
     *   <li>{@code format} â€” JSON (default for app) or RAW.</li>
     *   <li>{@code lines} â€” max lines to return (default 500).</li>
     * </ul>
     */
    @GetMapping("/{source}/{type}")
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<ApiResponse<?>> getLogs(
            @PathVariable String source,
            @PathVariable String type,
            @RequestParam(required = false, defaultValue = "JSON") LogFormat format,
            @RequestParam(required = false) Integer lines,
            @RequestParam(required = false) String date
    ) {
        try {
            LogSource.from(source); // validate source

            LocalDate queryDate = null;
            if (date != null && !date.isBlank()) {
                queryDate = LocalDate.parse(date);
            }

            LogsService.LogResponse response = logsService.getLogsForSource(
                    source, type, format, lines, queryDate);

            return ResponseEntity.ok(ApiResponse.success(Map.of(
                    "entries", response.getData(),
                    "count", response.getCount(),
                    "fileFound", response.isFileFound(),
                    "source", source,
                    "type", type,
                    "format", format,
                    "date", queryDate != null ? queryDate.toString() : LocalDate.now().toString()
            )));

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(HttpStatus.BAD_REQUEST, e.getMessage()));
        } catch (IOException e) {
            log.error("Error reading logs [{}/{}]: {}", source, type, e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error(HttpStatus.INTERNAL_SERVER_ERROR,
                            "Error reading logs: " + e.getMessage()));
        }
    }

    // =====================================================================
    // AVAILABLE DATES (for history picker)
    // =====================================================================

    @GetMapping("/{source}/{type}/dates")
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<ApiResponse<?>> getAvailableDates(
            @PathVariable String source,
            @PathVariable String type,
            @RequestParam(required = false, defaultValue = "JSON") LogFormat format
    ) {
        try {
            LogSource.from(source);
            List<String> dates = logsService.getAvailableDates(source, type, format);
            return ResponseEntity.ok(ApiResponse.success(dates));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(HttpStatus.BAD_REQUEST, e.getMessage()));
        } catch (IOException e) {
            log.error("Error listing dates [{}/{}]: {}", source, type, e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error(HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage()));
        }
    }

    // =====================================================================
    // LIVE STREAM (SSE)
    // =====================================================================

    @GetMapping(value = "/{source}/{type}/follow", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public SseEmitter followLogs(
            @PathVariable String source,
            @PathVariable String type,
            @RequestParam(required = false, defaultValue = "JSON") LogFormat format,
            HttpServletResponse response
    ) {
        // Disable proxy buffering — nginx defaults to proxy_buffering on, which
        // holds the chunked SSE response until its buffer fills and effectively
        // breaks the live stream. no-cache keeps any CDN/cache layer honest.
        response.setHeader("X-Accel-Buffering", "no");
        response.setHeader("Cache-Control", "no-cache, no-transform");

        String sessionId = source + "-" + type + "-" + System.currentTimeMillis();
        SseEmitter emitter = new SseEmitter(300_000L); // 5 minute timeout

        try {
            LogSource.from(source);
            sseEmitters.put(sessionId, emitter);

            emitter.send(SseEmitter.event()
                    .name("connect")
                    .data(Map.of("sessionId", sessionId, "source", source,
                            "type", type, "format", format)));

            // SSE keep-alive: comment lines starting with ':' are ignored by
            // the EventSource spec but reset proxy idle timers. Without this a
            // 60s idle nginx will close the upstream and the UI silently drops.
            ScheduledFuture<?> heartbeat = heartbeatExec.scheduleAtFixedRate(() -> {
                try {
                    emitter.send(SseEmitter.event().comment("ping"));
                } catch (Exception e) {
                    cleanupSse(sessionId);
                }
            }, HEARTBEAT_INTERVAL_SECONDS, HEARTBEAT_INTERVAL_SECONDS, TimeUnit.SECONDS);
            sseHeartbeats.put(sessionId, heartbeat);

            LogsService.FollowSession session = logsService.followLogsForSource(
                    source, type, format, sessionId,
                    line -> {
                        try {
                            emitter.send(SseEmitter.event()
                                    .name("log")
                                    .data(line)
                                    .id(String.valueOf(System.currentTimeMillis())));
                        } catch (IOException e) {
                            cleanupSse(sessionId);
                        }
                    }
            );
            sseThreads.put(sessionId, session.getThread());

            emitter.onCompletion(() -> cleanupSse(sessionId));
            emitter.onTimeout(() -> cleanupSse(sessionId));
            emitter.onError(e -> cleanupSse(sessionId));

        } catch (IllegalArgumentException e) {
            try {
                emitter.send(SseEmitter.event().name("error").data(e.getMessage()));
            } catch (IOException ignored) {}
            emitter.complete();
            sseEmitters.remove(sessionId);
        } catch (Exception e) {
            log.error("SSE setup failed [{}/{}]: {}", source, type, e.getMessage());
            cleanupSse(sessionId);
            emitter.completeWithError(e);
        }

        return emitter;
    }

    @DeleteMapping("/follow/{sessionId}")
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<ApiResponse<?>> stopFollow(@PathVariable String sessionId) {
        cleanupSse(sessionId);
        return ResponseEntity.ok(ApiResponse.success("Stopped"));
    }

    // =====================================================================
    // HELPERS
    // =====================================================================

    private void cleanupSse(String sessionId) {
        ScheduledFuture<?> hb = sseHeartbeats.remove(sessionId);
        if (hb != null) hb.cancel(false);
        SseEmitter emitter = sseEmitters.remove(sessionId);
        if (emitter != null) {
            try { emitter.complete(); } catch (Exception ignored) {}
        }
        Thread t = sseThreads.remove(sessionId);
        if (t != null && t.isAlive()) t.interrupt();
        logsService.stopFollowing(sessionId);
    }

    @PreDestroy
    void shutdownHeartbeats() {
        heartbeatExec.shutdownNow();
    }

    private String formatSourceLabel(LogSource src) {
        return switch (src) {
            case APP   -> "Application";
            case NGINX -> "Nginx";
            case ARIA2 -> "Aria2c";
            case MYSQL -> "MySQL";
        };
    }
}
