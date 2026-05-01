package com.db.dbworld.infrastructure.logging.controller;

import com.db.dbworld.infrastructure.logging.LogsService;
import com.db.dbworld.infrastructure.logging.dto.LogFormat;
import com.db.dbworld.infrastructure.logging.dto.LogType;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.config.AppConstants;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/logs")
@EnableMethodSecurity
public class LogsController {

    private final LogsService logsService;
    private final Map<String, SseEmitter> emitters     = new ConcurrentHashMap<>();
    private final Map<String, Thread>     followThreads = new ConcurrentHashMap<>();

    public LogsController(LogsService logsService) {
        this.logsService = logsService;
    }

    // â”€â”€ Unified endpoint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @GetMapping("/{source}/{type}")
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<ApiResponse<?>> getLogs(
            @PathVariable String source,
            @PathVariable LogType type,
            @RequestParam(defaultValue = "JSON") LogFormat format,
            @RequestParam(required = false) Integer lines,
            @RequestParam(required = false) Integer minutes
    ) {
        try {
            LogsService.LogResponse response = logsService.getLogs(type, format, lines, minutes);
            return ResponseEntity.ok(ApiResponse.success(response.getData()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(HttpStatus.BAD_REQUEST, "Invalid parameters: " + e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error(HttpStatus.INTERNAL_SERVER_ERROR, "Error reading logs: " + e.getMessage()));
        }
    }

    // â”€â”€ Backward-compatible aliases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @GetMapping("/app/{type}")
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<ApiResponse<?>> getApplicationLogs(
            @PathVariable LogType type,
            @RequestParam(defaultValue = "JSON") LogFormat format,
            @RequestParam(required = false) Integer lines,
            @RequestParam(required = false) Integer minutes
    ) {
        return getLogs("app", type, format, lines, minutes);
    }

    @GetMapping("/nginx/{type}")
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<ApiResponse<?>> getNginxLogs(
            @PathVariable LogType type,
            @RequestParam(defaultValue = "RAW") LogFormat format,
            @RequestParam(required = false) Integer lines,
            @RequestParam(required = false) Integer minutes
    ) {
        return getLogs("nginx", type, format, lines, minutes);
    }

    @GetMapping("/aria2c/{type}")
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<ApiResponse<?>> getAria2Logs(
            @PathVariable LogType type,
            @RequestParam(defaultValue = "RAW") LogFormat format,
            @RequestParam(required = false) Integer lines,
            @RequestParam(required = false) Integer minutes
    ) {
        return getLogs("aria2c", type, format, lines, minutes);
    }

    // â”€â”€ SSE live follow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @GetMapping(value = "/{source}/{type}/follow", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter followLogs(
            @PathVariable String source,
            @PathVariable LogType type,
            @RequestParam(defaultValue = "JSON") LogFormat format
    ) {
        String sessionId = source + "-" + type + "-" + System.currentTimeMillis() + "-" + Math.random();
        SseEmitter emitter = new SseEmitter(180_000L);

        try {
            emitters.put(sessionId, emitter);
            emitter.send(SseEmitter.event().name("connect").data(Map.of(
                    "status", "connected", "sessionId", sessionId,
                    "source", source, "type", type, "format", format)));

            Thread followThread = logsService.followLogs(type, format, sessionId, line -> {
                try {
                    emitter.send(SseEmitter.event().name("log").data(line)
                            .id(String.valueOf(System.currentTimeMillis())));
                } catch (IOException e) {
                    cleanup(sessionId);
                }
            }).getThread();

            followThreads.put(sessionId, followThread);
            emitter.onCompletion(() -> cleanup(sessionId));
            emitter.onTimeout(()    -> cleanup(sessionId));
            emitter.onError((e)     -> cleanup(sessionId));

        } catch (Exception e) {
            cleanup(sessionId);
            emitter.completeWithError(e);
        }
        return emitter;
    }

    @GetMapping(value = "/app/{type}/follow", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter followAppLogs(
            @PathVariable LogType type,
            @RequestParam(defaultValue = "JSON") LogFormat format
    ) {
        return followLogs("app", type, format);
    }

    // â”€â”€ Utility endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @DeleteMapping("/follow/{sessionId}")
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<ApiResponse<?>> stopFollowing(@PathVariable String sessionId) {
        cleanup(sessionId);
        return ResponseEntity.ok(ApiResponse.success("Stopped following logs"));
    }

    @GetMapping("/sessions")
    @PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<ApiResponse<?>> getActiveSessions() {
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "activeSessions", emitters.keySet(),
                "count", emitters.size(),
                "threads", followThreads.size())));
    }

    @GetMapping("/health")
    public ResponseEntity<ApiResponse<?>> health() {
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "status", "ok",
                "activeSessions", emitters.size(),
                "activeThreads", followThreads.size())));
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private void cleanup(String sessionId) {
        try {
            SseEmitter emitter = emitters.remove(sessionId);
            if (emitter != null) {
                try { emitter.complete(); } catch (Exception ignored) {}
            }
            Thread thread = followThreads.remove(sessionId);
            if (thread != null && thread.isAlive()) thread.interrupt();
            logsService.stopFollowing(sessionId);
        } catch (Exception ignored) {}
    }
}
