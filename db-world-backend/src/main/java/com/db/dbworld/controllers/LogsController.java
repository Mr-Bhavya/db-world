package com.db.dbworld.controllers;

import com.db.dbworld.logging.LogsService;
import com.db.dbworld.logging.dto.LogFormat;
import com.db.dbworld.logging.dto.LogType;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.utils.DbWorldConstants;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@CrossOrigin
@RestController
@RequestMapping("/api/logs")
@EnableMethodSecurity
public class LogsController {

    private final LogsService logsService;
    private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();
    private final Map<String, Thread> followThreads = new ConcurrentHashMap<>();

    public LogsController(LogsService logsService) {
        this.logsService = logsService;
    }

    // =====================================================
    // UNIFIED LOGS ENDPOINT
    // =====================================================

    @GetMapping("/{source}/{type}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<ApiResponse<?>> getLogs(
            @PathVariable String source,
            @PathVariable LogType type,
            @RequestParam(defaultValue = "JSON") LogFormat format,
            @RequestParam(required = false) Integer lines,
            @RequestParam(required = false) Integer minutes
    ) {
        try {
            LogsService.LogResponse response = logsService.getLogs(
                    type,
                    format,
                    lines,
                    minutes
            );

            return ResponseEntity.ok(ApiResponse.success(response.getData()));

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(HttpStatus.BAD_REQUEST, "Invalid parameters: " + e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error(HttpStatus.INTERNAL_SERVER_ERROR, "Error reading logs: " + e.getMessage()));
        }
    }

    // =====================================================
    // APPLICATION LOGS (Backward compatible)
    // =====================================================

    @GetMapping("/app/{type}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<ApiResponse<?>> getApplicationLogs(
            @PathVariable LogType type,
            @RequestParam(defaultValue = "JSON") LogFormat format,
            @RequestParam(required = false) Integer lines,
            @RequestParam(required = false) Integer minutes
    ) {
        return getLogs("app", type, format, lines, minutes);
    }

    // =====================================================
    // NGINX LOGS (Backward compatible)
    // =====================================================

    @GetMapping("/nginx/{type}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<ApiResponse<?>> getNginxLogs(
            @PathVariable LogType type,
            @RequestParam(defaultValue = "RAW") LogFormat format,
            @RequestParam(required = false) Integer lines,
            @RequestParam(required = false) Integer minutes
    ) {
        return getLogs("nginx", type, format, lines, minutes);
    }

    // =====================================================
    // ARIA2 LOGS (Backward compatible)
    // =====================================================

    @GetMapping("/aria2c/{type}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<ApiResponse<?>> getAria2Logs(
            @PathVariable LogType type,
            @RequestParam(defaultValue = "RAW") LogFormat format,
            @RequestParam(required = false) Integer lines,
            @RequestParam(required = false) Integer minutes
    ) {
        return getLogs("aria2c", type, format, lines, minutes);
    }

    // =====================================================
    // LIVE FOLLOW STREAM (SSE) - FIXED VERSION
    // =====================================================

    @GetMapping(
            value = "/{source}/{type}/follow",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public SseEmitter followLogs(
            @PathVariable String source,
            @PathVariable LogType type,
            @RequestParam(defaultValue = "JSON") LogFormat format
    ) {
        String sessionId = source + "-" + type + "-" + System.currentTimeMillis() + "-" + Math.random();
        SseEmitter emitter = new SseEmitter(180_000L); // 3 minute timeout

        try {
            // Store emitter
            emitters.put(sessionId, emitter);

            // Send initial connection event
            emitter.send(SseEmitter.event()
                    .name("connect")
                    .data(Map.of(
                            "status", "connected",
                            "sessionId", sessionId,
                            "source", source,
                            "type", type,
                            "format", format
                    ))
            );

            // Start following logs
            Thread followThread = logsService.followLogs(
                    type,
                    format,
                    sessionId,
                    line -> {
                        try {
                            emitter.send(SseEmitter.event()
                                    .name("log")
                                    .data(line)
                                    .id(String.valueOf(System.currentTimeMillis())));
                        } catch (IOException e) {
                            // Client disconnected - clean up
                            cleanup(sessionId);
                        }
                    }
            ).getThread();

            followThreads.put(sessionId, followThread);

            // Set up cleanup handlers
            emitter.onCompletion(() -> {
                System.out.println("SSE completed for session: " + sessionId);
                cleanup(sessionId);
            });

            emitter.onTimeout(() -> {
                System.out.println("SSE timeout for session: " + sessionId);
                cleanup(sessionId);
            });

            emitter.onError((e) -> {
                System.err.println("SSE error for session: " + sessionId + " - " + e.getMessage());
                cleanup(sessionId);
            });

        } catch (Exception e) {
            System.err.println("Error setting up SSE for session: " + sessionId + " - " + e.getMessage());
            cleanup(sessionId);
            emitter.completeWithError(e);
        }

        return emitter;
    }

    /**
     * Legacy follow endpoint for backward compatibility
     */
    @GetMapping(
            value = "/app/{type}/follow",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public SseEmitter followAppLogs(
            @PathVariable LogType type,
            @RequestParam(defaultValue = "JSON") LogFormat format
    ) {
        return followLogs("app", type, format);
    }

    // =====================================================
    // UTILITY ENDPOINTS
    // =====================================================

    @DeleteMapping("/follow/{sessionId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<ApiResponse<?>> stopFollowing(@PathVariable String sessionId) {
        cleanup(sessionId);
        return ResponseEntity.ok(ApiResponse.success("Stopped following logs"));
    }

    @GetMapping("/sessions")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<ApiResponse<?>> getActiveSessions() {
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "activeSessions", emitters.keySet(),
                "count", emitters.size(),
                "threads", followThreads.size()
        )));
    }

    @GetMapping("/health")
    public ResponseEntity<ApiResponse<?>> health() {
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "status", "ok",
                "activeSessions", emitters.size(),
                "activeThreads", followThreads.size()
        )));
    }

    // =====================================================
    // PRIVATE HELPER METHODS
    // =====================================================

    private void cleanup(String sessionId) {
        try {
            // Remove and complete emitter
            SseEmitter emitter = emitters.remove(sessionId);
            if (emitter != null) {
                try {
                    emitter.complete();
                } catch (Exception e) {
                    // Ignore completion errors
                }
            }

            // Stop follow thread
            Thread thread = followThreads.remove(sessionId);
            if (thread != null && thread.isAlive()) {
                thread.interrupt();
            }

            // Stop logs service follow
            logsService.stopFollowing(sessionId);

        } catch (Exception e) {
            System.err.println("Error during cleanup for session: " + sessionId + " - " + e.getMessage());
        }
    }
}