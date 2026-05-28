package com.db.dbworld.app.media.aria2.ws;

import com.db.dbworld.app.media.aria2.Aria2DownloadMappingService;
import com.db.dbworld.app.media.aria2.Aria2RpcService;
import com.db.dbworld.app.media.aria2.model.*;
import com.db.dbworld.app.media.ingestion.store.IngestionJobStore;
import com.db.dbworld.app.media.ingestion.tracking.ProgressSnapshot;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.*;
import org.springframework.web.socket.client.WebSocketClient;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import static com.db.dbworld.app.media.aria2.Aria2StatusKeys.DETAILED_KEYS;
import static com.db.dbworld.app.media.aria2.Aria2StatusKeys.FINAL_STATUS_KEYS;

/**
 * WebSocket client for Aria2 real-time download notifications.
 *
 * Replaces {@code services.aria2.Aria2WebSocketClientService}.
 *
 * Key improvements / decoupling from old architecture:
 * <ul>
 *   <li><b>No {@code StatusService} or {@code MirrorHelper}</b> — progress is
 *       reported via {@link TrackingService#updateProgress}; completion is
 *       handled by {@link com.db.dbworld.app.media.ingestion.download.Aria2DownloadStrategy}'s
 *       polling loop (no duplicate post-processing here).</li>
 *   <li><b>GID discovery from {@link IngestionJobStore}</b> — the client polls
 *       all active GIDs without requiring explicit {@code startMonitoring()} calls,
 *       so {@code Aria2DownloadStrategy} does not need to know about this bean.</li>
 *   <li><b>Torrent metadata GID remap</b> — when a metadata download completes the
 *       actual download GID is updated in {@link IngestionJobStore} and
 *       {@link Aria2DownloadMappingService}, so the polling loop follows the right GID.</li>
 * </ul>
 */
@Log4j2
@Service
public class Aria2WebSocketClientService {

    private static final String TAG = "[WS]";

    private final String  aria2WsUrl;
    private final String  rpcSecret;
    private final ObjectMapper objectMapper;

    private final Aria2RpcService            aria2RpcService;
    private final Aria2DownloadMappingService mappingService;
    private final TrackingService            trackingService;
    private final IngestionJobStore          jobStore;

    private final WebSocketClient         webSocketClient  = new StandardWebSocketClient();
    private final WebSocketConnectionState connectionState = new WebSocketConnectionState();

    public Aria2WebSocketClientService(
            @Value("${aria2.ws-url}") String aria2WsUrl,
            @Value("${aria2.secret}")  String rpcSecret,
            ObjectMapper objectMapper,
            @Qualifier("appAria2RpcService")            Aria2RpcService            aria2RpcService,
            @Qualifier("appAria2DownloadMappingService") Aria2DownloadMappingService mappingService,
            TrackingService  trackingService,
            IngestionJobStore jobStore
    ) {
        this.aria2WsUrl     = aria2WsUrl;
        this.rpcSecret      = rpcSecret;
        this.objectMapper   = objectMapper;
        this.aria2RpcService = aria2RpcService;
        this.mappingService  = mappingService;
        this.trackingService = trackingService;
        this.jobStore        = jobStore;

        connectionState.setConnectionId(UUID.randomUUID().toString());
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @PostConstruct
    public void init() {
        log.info("{} Aria2 WebSocket client initialised (on-demand connection)", TAG);
    }

    @PreDestroy
    public void cleanup() {
        disconnect();
    }

    // ── Scheduled polling ─────────────────────────────────────────────────────

    /**
     * Polls status for every active Aria2 GID every 2 seconds.
     * GIDs are discovered from {@link IngestionJobStore} — no explicit registration needed.
     */
    @Scheduled(fixedRate = Aria2WebSocketConfig.STATUS_POLL_INTERVAL_MS)
    public void pollActiveDownloads() {
        Map<String, String> activeGids = jobStore.getAllActiveGids(); // jobId → gid
        if (activeGids.isEmpty()) {
            maybeDrainConnection();
            return;
        }

        connectIfNeeded();

        if (!connectionState.getIsConnected().get()) return;

        long now = System.currentTimeMillis();
        activeGids.forEach((jobId, gid) -> {
            Long lastUpdate = mappingService.getLastUpdateTime(gid);
            if (lastUpdate == null || (now - lastUpdate) > Aria2WebSocketConfig.STATUS_POLL_INTERVAL_MS) {
                requestStatus(gid);
            }
        });

        connectionState.updateActivity();
    }

    // ── Connection management ─────────────────────────────────────────────────

    private void connectIfNeeded() {
        if (connectionState.getIsConnected().get() && connectionState.getSession() != null
                && connectionState.getSession().isOpen()) {
            connectionState.updateActivity();
            return;
        }
        connectWithRetry();
    }

    private void connectWithRetry() {
        try {
            connectionState.setSession(
                    webSocketClient.execute(
                            new Aria2MessageHandler(),
                            new WebSocketHttpHeaders(),
                            new URI(aria2WsUrl)
                    ).get()
            );
            connectionState.getIsConnected().set(true);
            connectionState.resetReconnectAttempts();
            connectionState.setConnectionTime(LocalDateTime.now());
            connectionState.updateActivity();
            log.info("{} Connected to Aria2", TAG);
        } catch (Exception e) {
            log.debug("{} Connection failed: {}", TAG, e.getMessage());
            scheduleReconnect();
        }
    }

    private void scheduleReconnect() {
        int active = jobStore.getAllActiveGids().size();
        connectionState.setActiveDownloadsCount(active);
        if (active == 0 || !connectionState.shouldReconnect(Aria2WebSocketConfig.MAX_RECONNECT_ATTEMPTS)) return;

        connectionState.incrementReconnectAttempts();
        int attempt = connectionState.getReconnectAttempts().get();
        long delay  = (long) Aria2WebSocketConfig.RECONNECT_DELAY_MS * Math.min(attempt, 5);

        log.debug("{} Scheduling reconnect in {}ms (attempt {})", TAG, delay, attempt);
        Thread t = new Thread(() -> {
            try { Thread.sleep(delay); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); return; }
            connectWithRetry();
        }, "ws-reconnect");
        t.setDaemon(true);
        t.start();
    }

    private void disconnect() {
        WebSocketSession session = connectionState.getSession();
        if (session != null && session.isOpen()) {
            try { session.close(); } catch (IOException ignored) {}
        }
        connectionState.getIsConnected().set(false);
        log.info("{} Disconnected", TAG);
    }

    private void maybeDrainConnection() {
        if (connectionState.getIsConnected().get()
                && connectionState.getInactiveDuration() > Aria2WebSocketConfig.INACTIVITY_TIMEOUT_MS) {
            log.info("{} Closing idle WebSocket connection", TAG);
            disconnect();
        }
    }

    // ── RPC helpers ───────────────────────────────────────────────────────────

    private void requestStatus(String gid) {
        if (!connectionState.getIsConnected().get() || connectionState.getSession() == null) return;
        try {
            Aria2WebSocketRequest req = new Aria2WebSocketRequest();
            req.setId("status-" + gid);
            req.setMethod("aria2.tellStatus");
            req.setParams(List.of("token:" + rpcSecret, gid, DETAILED_KEYS));
            connectionState.getSession().sendMessage(new TextMessage(objectMapper.writeValueAsString(req)));
            mappingService.touchGid(gid);
        } catch (IOException e) {
            log.debug("{} Failed to request status for GID {}: {}", TAG, gid, e.getMessage());
        }
    }

    // ── Progress updates ──────────────────────────────────────────────────────

    private void pushProgress(String gid, Aria2StatusParam status) {
        String jobId = resolveJobId(gid);
        if (jobId == null) return;

        Long   total     = status.getTotalLength();
        Long   completed = status.getCompletedLength();
        Long   speed     = status.getDownloadSpeed();

        if (total != null && total > 0 && completed != null) {
            long eta = (speed != null && speed > 0) ? (total - completed) / speed : 0L;
            trackingService.updateProgress(jobId,
                    ProgressSnapshot.downloading(completed, total,
                            speed != null ? speed.doubleValue() : 0.0, eta));
        }
    }

    // ── Torrent metadata GID remap ────────────────────────────────────────────

    private void handleTorrentMetadata(String metadataGid, Aria2StatusParam status) {
        List<String> followedBy = status.getFollowedBy();
        if (followedBy == null || followedBy.isEmpty()) return;

        String actualGid = followedBy.getFirst();
        String jobId     = resolveJobId(metadataGid);

        if (mappingService.getJobIdByGid(actualGid) != null) {
            return;
        }

        if (actualGid.equals(jobStore.getGid(jobId))) {
            return;
        }

        log.info("{} Torrent metadata complete for GID {} → actual GID {}", TAG, metadataGid, actualGid);

        if (jobId != null) {
            // Update job store so the polling loop follows the new GID
            jobStore.setGid(jobId, actualGid);
            // Update the WS mapping service
            mappingService.removeByGid(metadataGid);
            mappingService.addMapping(jobId, actualGid);
            log.info("{} Remapped jobId={} to actualGid={}", TAG, jobId, actualGid);
        }
    }

    // ── Utility ───────────────────────────────────────────────────────────────

    /** Looks up jobId by GID: first checks mapping service, then scans job store. */
    private String resolveJobId(String gid) {
        String fromMapping = mappingService.getJobIdByGid(gid);
        if (fromMapping != null) return fromMapping;

        // Fallback: scan active GIDs in job store (cheap — O(n) where n = active downloads)
        return jobStore.getAllActiveGids().entrySet().stream()
                .filter(e -> gid.equals(e.getValue()))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse(null);
    }

    // ── WebSocket message handler ─────────────────────────────────────────────

    private class Aria2MessageHandler extends TextWebSocketHandler {

        @Override
        public void afterConnectionEstablished(WebSocketSession session) {
            connectionState.setSession(session);
            connectionState.getIsConnected().set(true);
            connectionState.resetReconnectAttempts();
            connectionState.setConnectionTime(LocalDateTime.now());
            connectionState.updateActivity();
            log.info("{} Connection established", TAG);

            // Re-poll all active GIDs immediately after reconnect
            jobStore.getAllActiveGids().values().forEach(gid -> requestStatus(gid));
        }

        @Override
        public void handleTransportError(WebSocketSession session, Throwable ex) {
            log.debug("{} Transport error: {}", TAG, ex.getMessage());
            connectionState.getIsConnected().set(false);
            if (!jobStore.getAllActiveGids().isEmpty()) scheduleReconnect();
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
            log.debug("{} Connection closed: {}", TAG, status);
            connectionState.getIsConnected().set(false);
            if (!jobStore.getAllActiveGids().isEmpty()) scheduleReconnect();
        }

        @Override
        public void handleTextMessage(WebSocketSession session, TextMessage message) {
            connectionState.updateActivity();
            WebSocketMessageContext ctx = parseMessage(message.getPayload());

            if (ctx.hasError()) {
                log.debug("{} Message error: {}", TAG, ctx.getErrorMessage());
                return;
            }

            try {
                if ("notification".equals(ctx.getMessageType())) {
                    handleNotification(ctx.getNotification());
                } else if ("response".equals(ctx.getMessageType())) {
                    handleResponse(ctx.getResponse());
                }
            } catch (Exception e) {
                log.debug("{} Message handling error", TAG, e);
            }
        }

        private WebSocketMessageContext parseMessage(String payload) {
            WebSocketMessageContext ctx = new WebSocketMessageContext();
            ctx.setRawMessage(payload == null ? "" : payload.trim());
            if (ctx.getRawMessage().isEmpty() || "[]".equals(ctx.getRawMessage())) return ctx;

            try {
                JsonNode json = objectMapper.readTree(ctx.getRawMessage());
                if (json.has("method")) {
                    ctx.setNotification(objectMapper.convertValue(json, Aria2WebSocketNotification.class));
                    ctx.setMessageType("notification");
                } else if (json.has("result") || json.has("error")) {
                    ctx.setResponse(objectMapper.convertValue(json, Aria2WebSocketResponse.class));
                    ctx.setMessageType("response");
                } else {
                    ctx.setMessageType("unknown");
                }
            } catch (Exception e) {
                ctx.setProcessingError(e);
            }
            return ctx;
        }

        // ── notification handlers ───────────────────────────────────────────

        private void handleNotification(Aria2WebSocketNotification notification) throws Exception {
            if (notification == null || notification.getParams() == null
                    || notification.getParams().isEmpty()) return;

            String gid    = notification.getParams().get(0).getGid();
            String method = notification.getMethod();

            switch (method) {
                case "aria2.onDownloadComplete", "aria2.onBtDownloadComplete" -> {
                    Aria2StatusParam full = aria2RpcService.tellStatus(gid, FINAL_STATUS_KEYS);
                    if (full != null && full.isMetadataDownload()) {
                        handleTorrentMetadata(gid, full);
                    } else {
                        log.info("{} Download complete notification for GID {}", TAG, gid);
                        // Polling loop will detect completion and handle post-processing
                    }
                }
                case "aria2.onDownloadError" -> {
                    log.warn("{} Download error notification for GID {}", TAG, gid);
                    // Polling loop will detect error and fail the job
                }
                case "aria2.onDownloadStart" -> {
                    log.info("{} Download started for GID {}", TAG, gid);
                }
                default -> log.debug("{} Unhandled notification: {} gid={}", TAG, method, gid);
            }
        }

        // ── response handlers ───────────────────────────────────────────────

        private void handleResponse(Aria2WebSocketResponse response) {
            if (response == null || response.getResult() == null) return;
            Aria2StatusParam status = response.getResult();

            if (status.isMetadataDownload()) {
                handleTorrentMetadata(status.getGid(), status);
            } else {
                pushProgress(status.getGid(), status);
            }
        }
    }
}
