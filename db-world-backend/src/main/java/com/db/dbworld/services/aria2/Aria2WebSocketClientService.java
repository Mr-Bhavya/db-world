package com.db.dbworld.services.aria2;

import com.db.dbworld.helpers.MirrorHelper;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.aria2.model.*;
import com.db.dbworld.services.mirror.StatusService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.task.TaskExecutor;
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
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

import static com.db.dbworld.services.aria2.Aria2StatusKeys.*;

@Log4j2
@Service
public class Aria2WebSocketClientService {
    private static final int RECONNECT_DELAY_MS = 5000;
    private static final int MAX_RECONNECT_ATTEMPTS = 10;
    private static final int STATUS_POLL_INTERVAL_MS = 2000;
    private static final long INACTIVITY_TIMEOUT_MS = 5 * 60 * 60 * 1000; // 5 hours

    private final String aria2WsUrl;
    private final String rpcSecret;
    private final ObjectMapper objectMapper;
    private final StatusService statusService;
    private final Aria2RpcService aria2RpcService;
    private final Aria2DownloadMappingService mappingService;
    private final MirrorHelper mirrorHelper;

    private final WebSocketClient webSocketClient;
    private final WebSocketConnectionState connectionState;

    private final AtomicLong lastActivityTime = new AtomicLong(System.currentTimeMillis());
    private final ScheduledExecutorService inactivityMonitor = Executors.newSingleThreadScheduledExecutor();

    public Aria2WebSocketClientService(
            @Value("${aria2.ws-url}") String aria2WsUrl,
            @Value("${aria2.secret}") String rpcSecret,
            ObjectMapper objectMapper,
            StatusService statusService,
            Aria2RpcService aria2RpcService, Aria2DownloadMappingService mappingService, TaskExecutor taskExecutor, MirrorHelper mirrorHelper, Aria2ResponseMapper aria2ResponseMapper) {
        this.aria2WsUrl = aria2WsUrl;
        this.rpcSecret = rpcSecret;
        this.objectMapper = objectMapper;
        this.statusService = statusService;
        this.aria2RpcService = aria2RpcService;
        this.mappingService = mappingService;
        this.mirrorHelper = mirrorHelper;
        this.webSocketClient = new StandardWebSocketClient();
        this.connectionState = new WebSocketConnectionState();
        this.connectionState.setConnectionId(UUID.randomUUID().toString());
    }

    @PostConstruct
    public void init() {
        log.info("Initializing Aria2 WebSocket client with on-demand connection...");
        startInactivityMonitor();
    }

    @PreDestroy
    public void cleanup() {
        log.info("Shutting down Aria2 WebSocket client...");
        inactivityMonitor.shutdown();
        disconnect();
    }

    private void startInactivityMonitor() {
        inactivityMonitor.scheduleAtFixedRate(this::checkAndDisconnectIfInactive, 1, 1, TimeUnit.MINUTES);
    }

    private void checkAndDisconnectIfInactive() {
        connectionState.setActiveDownloadsCount(mappingService.getActiveDownloadsCount());

        if (connectionState.getIsConnected().get() && connectionState.getActiveDownloadsCount() == 0) {
            long inactiveTime = connectionState.getInactiveDuration();
            if (inactiveTime > Aria2WebSocketConfig.INACTIVITY_TIMEOUT_MS) {
                log.info("No active downloads for {} minutes. Closing WebSocket connection.",
                        Aria2WebSocketConfig.INACTIVITY_TIMEOUT_MS / (60 * 1000));
                disconnect();
            }
        }
    }

    private void connectIfNeeded() {
        if (!connectionState.getIsConnected().get() || connectionState.getSession() == null) {
            log.debug("WebSocket not connected, initiating connection...");
            connectWithRetry();
        } else {
            connectionState.updateActivity();
        }
    }

    private void connectWithRetry() {
        try {
            log.debug("Connecting to Aria2 WebSocket in thread: {}", Thread.currentThread().getName());
            URI uri = new URI(aria2WsUrl);
            WebSocketHttpHeaders headers = new WebSocketHttpHeaders();

            this.connectionState.setSession(
                    webSocketClient.execute(new Aria2WebSocketHandler(), headers, uri).get()
            );
            connectionState.resetReconnectAttempts();
            connectionState.setIsConnected(new AtomicBoolean(true));
            connectionState.setConnectionTime(LocalDateTime.now());
            connectionState.updateActivity();

            log.debug("✅ WebSocket connection established");
        } catch (Exception e) {
            log.debug("Failed to connect to Aria2 WebSocket", e);
            scheduleReconnect();
        }
    }

    public void startDownloadMonitoring(String gid, String mirrorId) {
        log.info("Starting download monitoring for GID: {}, Mirror: {}", gid, mirrorId);

        // Add mapping first
        mappingService.addMappingToActiveDownloads(mirrorId, gid);

        // Update activity time
        connectionState.updateActivity();

        // Connect if not connected
        connectIfNeeded();

        MirrorStatus mirrorStatus = statusService.getStatusById(mirrorId);
        if (mirrorStatus != null) {
            statusService.logAndAppendHtml(mirrorStatus,
                    "🔍 Started monitoring GID " + gid + " for mirror " + mirrorId, false);
        }
    }

    private void scheduleReconnect() {
        connectionState.setActiveDownloadsCount(mappingService.getActiveDownloadsCount());

        if (connectionState.getActiveDownloadsCount() == 0) {
            log.debug("No active downloads, not scheduling reconnect");
            return;
        }

        if (!connectionState.shouldReconnect(Aria2WebSocketConfig.MAX_RECONNECT_ATTEMPTS)) {
            log.warn("Max reconnection attempts reached");
            return;
        }

        connectionState.incrementReconnectAttempts();
        int attempts = connectionState.getReconnectAttempts().get();
        long delay = (long) Aria2WebSocketConfig.RECONNECT_DELAY_MS * Math.min(attempts, 5);

        log.debug("Scheduling reconnect in {}ms (attempt {})", delay, attempts);
        new Thread(() -> {
            try {
                Thread.sleep(delay);
                connectWithRetry();
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
        }).start();
    }

    private void disconnect() {
        if (connectionState.getSession() != null && connectionState.getSession().isOpen()) {
            try {
                connectionState.getSession().close();
            } catch (IOException e) {
                log.debug("Error closing WebSocket session", e);
            }
        }
        connectionState.setIsConnected(new AtomicBoolean(false));
        log.info("WebSocket connection closed");
    }

    @Scheduled(fixedRate = Aria2WebSocketConfig.STATUS_POLL_INTERVAL_MS)
    public void pollActiveDownloads() {
        if (!connectionState.getIsConnected().get() || mappingService.getActiveDownloadsCount() == 0) {
            return;
        }

        long now = System.currentTimeMillis();
        mappingService.getActiveDownloads().forEach((gid, mirrorId) -> {
            Long lastUpdate = mappingService.getLastStatusUpdate(gid);
            if (lastUpdate == null || (now - lastUpdate) > Aria2WebSocketConfig.STATUS_POLL_INTERVAL_MS) {
                requestDownloadStatus(gid);
            }
        });

        connectionState.updateActivity();
    }

    private void requestDownloadStatus(String gid) {
        if (!connectionState.getIsConnected().get() || connectionState.getSession() == null) {
            log.debug("WebSocket not connected, cannot request status for GID: {}", gid);
            return;
        }

        try {
            Aria2WebSocketRequest request = createStatusRequest(gid);
            String message = objectMapper.writeValueAsString(request);

            connectionState.getSession().sendMessage(new TextMessage(message));
            mappingService.updateLastStatusTime(gid);
            connectionState.updateActivity();

        } catch (IOException e) {
            log.debug("Failed to request status for GID: {}", gid, e);
        }
    }

    private Aria2WebSocketRequest createStatusRequest(String gid) {
        Aria2WebSocketRequest request = new Aria2WebSocketRequest();
        request.setId("status-" + gid);
        request.setMethod("aria2.tellStatus");
        request.setParams(List.of(
                "token:" + rpcSecret,
                gid, DETAILED_KEYS
        ));
        return request;
    }

    private MirrorStatus getMirrorStatusForGid(String gid) {
        String mirrorId = mappingService.getMirrorIdByGid(gid);
        return mirrorId != null ? statusService.getStatusById(mirrorId) : null;
    }

    // WebSocket message handler
    private class Aria2WebSocketHandler extends TextWebSocketHandler {

        @Override
        public void afterConnectionEstablished(WebSocketSession session) {
            connectionState.setIsConnected(new AtomicBoolean(true));
            connectionState.resetReconnectAttempts();
            connectionState.updateActivity();
            connectionState.setConnectionTime(LocalDateTime.now());
            log.debug("✅ Connected to Aria2 WebSocket");

            // Restore monitoring for active downloads after reconnection
            if (!mappingService.getActiveDownloads().isEmpty()) {
                log.debug("Restoring monitoring for {} active downloads", mappingService.getActiveDownloads().size());
                mappingService.getActiveDownloads().keySet().forEach(Aria2WebSocketClientService.this::requestDownloadStatus);
            }
        }

        @Override
        public void handleTransportError(WebSocketSession session, Throwable exception) {
            log.debug("WebSocket transport error", exception);
            connectionState.setIsConnected(new AtomicBoolean(false));

            if (mappingService.getActiveDownloadsCount() > 0) {
                scheduleReconnect();
            }
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
            log.debug("WebSocket connection closed: {}.", status);
            connectionState.setIsConnected(new AtomicBoolean(false));

            if (mappingService.getActiveDownloadsCount() > 0) {
                log.debug("Reconnecting due to active downloads...");
                scheduleReconnect();
            } else {
                log.debug("No active downloads, not reconnecting.");
            }
        }

        @Override
        public void handleTextMessage(WebSocketSession session, TextMessage message) {
            connectionState.updateActivity();

            WebSocketMessageContext context = processMessage(message);
            if (context.hasError()) {
                log.error("Error processing WebSocket message: {}", context.getErrorMessage());
                return;
            }

            try {
                if (context.getMessageType().equals("notification")) {
//                    handleNotification(context.getNotification());
                } else if (context.getMessageType().equals("response")) {
                    handleResponse(context.getResponse().getResult());
                }
            } catch (Exception e) {
                log.error("Error handling processed message", e);
            }
        }

        private WebSocketMessageContext processMessage(TextMessage message) {
            WebSocketMessageContext context = new WebSocketMessageContext();
            context.setRawMessage(message.getPayload().trim());

            if (context.getRawMessage().isEmpty() || context.getRawMessage().equals("[]")) {
                return context;
            }

            try {
                JsonNode json = objectMapper.readTree(context.getRawMessage());

                if (json.has("method")) {
                    Aria2WebSocketNotification notification = objectMapper.convertValue(json, Aria2WebSocketNotification.class);
                    context.setNotification(notification);
                    context.setMessageType("notification");
                } else if (json.has("result")) {
                    Aria2WebSocketResponse response = objectMapper.convertValue(json, Aria2WebSocketResponse.class);
                    context.setResponse(response);
                    context.setMessageType("response");
                } else {
                    context.setMessageType("unknown");
                }

            } catch (Exception e) {
                context.setProcessingError(e);
                log.error("Error parsing WebSocket message: {}", context.getRawMessage(), e);
            }

            return context;
        }

        private void handleNotification(Aria2WebSocketNotification notification) throws Exception {
            if (notification == null || notification.getParams() == null || notification.getParams().isEmpty()) {
                return;
            }

            Aria2StatusParam params = notification.getParams().get(0);
            String method = notification.getMethod();

            params = aria2RpcService.tellStatus(params.getGid(), DETAILED_KEYS);

            switch (method) {
//                case "aria2.onDownloadStart" -> handleDownloadStart(params);
//                case "aria2.onDownloadPause" -> handleDownloadPause(params);
//                case "aria2.onDownloadStop" -> handleDownloadStop(params);
                case "aria2.onDownloadComplete" -> handleDownloadComplete(params);
                case "aria2.onBtDownloadComplete" -> handleBtDownloadComplete(params);
                case "aria2.onDownloadError" -> handleDownloadError(params);
                default -> log.debug("Received unhandled notification: {} for GID: {}", method, params.getGid());
            }

            // Update activity time on any notification
            lastActivityTime.set(System.currentTimeMillis());
        }

        private void handleResponse(Aria2StatusParam aria2DownloadStatus) throws Exception {

//            aria2DownloadStatus = aria2RpcService.tellStatus(aria2DownloadStatus.getGid(), DETAILED_KEYS);

            if (aria2DownloadStatus == null) {
                return;
            }

            if (aria2DownloadStatus.getErrorCode() != null && aria2DownloadStatus.getErrorMessage() != null
                    && aria2DownloadStatus.isError()) {
                handleDownloadError(aria2DownloadStatus);
            } else if(aria2DownloadStatus.isComplete()){
                handleDownloadComplete(aria2DownloadStatus);
            } else {
                updateMirrorStatus(aria2DownloadStatus.getGid(), aria2DownloadStatus);
            }
        }

        private void handleDownloadStart(Aria2StatusParam params) {
            log.info("🚀 Download started - GID: {}", params.getGid());
        }

        private void handleDownloadPause(Aria2StatusParam params) {
            log.info("⏸️ Download paused - GID: {}", params.getGid());
            MirrorStatus mirrorStatus = getMirrorStatusForGid(params.getGid());
            if (mirrorStatus != null) {
                statusService.logAndAppendHtml(mirrorStatus,
                        "⏸️ Download paused for GID " + params.getGid() + " and mirror " + mirrorStatus.getId(), false);
//                statusService.updateMirrorStatusWithPause(mirrorStatus.getId());
            }
        }

        private void handleDownloadStop(Aria2StatusParam params) {
            log.info("⏹️ Download stopped - GID: {}", params.getGid());
        }

        private void handleDownloadComplete(Aria2StatusParam params) {
            handleDownloadCompletion(params, false);
        }

        private void handleBtDownloadComplete(Aria2StatusParam params) {
            log.info("🔍 BitTorrent download completed - GID: {}", params.getGid());
            handleDownloadCompletion(params, true);
        }

        private void handleDownloadError(Aria2StatusParam aria2DownloadStatus) {
            String errorMessage = aria2DownloadStatus.getErrorMessage();
            Integer errorCode = aria2DownloadStatus.getErrorCode();
            String gid = aria2DownloadStatus.getGid();
            MirrorStatus mirrorStatus = getMirrorStatusForGid(gid);
            log.error("Aria2 RPC Error code: {}, message: {}", errorCode, errorMessage);
            if (mirrorStatus != null) {
                statusService.logAndAppendHtml(mirrorStatus,
                        "❌ Download failed: Error Code: " + errorCode + "ErrorMessage: " + errorMessage, true);
                mirrorHelper.postDownloadTasks(mirrorStatus.getId());
            }
            mappingService.removeMapping(gid);
        }

        private void updateMirrorStatus(String gid, Aria2StatusParam result) {
            String mirrorId = mappingService.getMirrorIdByGid(gid);
            if (mirrorId == null) return;

            MirrorStatus mirrorStatus = statusService.getStatusById(mirrorId);
            if (mirrorStatus == null) return;

            try {
                statusService.updateMirrorStatusFromAria2(mirrorStatus, result);
                mappingService.updateLastStatusTime(gid);
            } catch (Exception e) {
                log.error("Failed to update mirror status for GID: {}", gid, e);
            }
        }
    }

    private void handleDownloadCompletion(Aria2StatusParam status, boolean isBtDownload) {
        MirrorStatus mirrorStatus = getMirrorStatusForGid(status.getGid());
        try {
            if (status.isMetadataDownload()) {
                log.info("📥 Torrent metadata download completed - GID: {}, Mirror: {}", status.getGid(),
                        mirrorStatus != null ? mirrorStatus.getId() : "unknown");

                // This is a metadata download completion, find the actual download GIDs
                handleTorrentMetadataCompletion(status.getGid(), status, mirrorStatus);
            } else {
                status = aria2RpcService.tellStatus(status.getGid(), FINAL_STATUS_KEYS);
                log.info("Download completed - GID: {}, Mirror: {}", status.getGid(), mirrorStatus != null ? mirrorStatus.getId() : "unknown");

                // This is the actual content download completion
                if (mirrorStatus != null) {
                    statusService.updateMirrorStatusFromAria2(mirrorStatus, status);
                    statusService.logAndAppendHtml(mirrorStatus, "✅ Download completed", false);
                    mirrorHelper.postDownloadTasks(mirrorStatus.getId());
                }

                mappingService.removeMapping(status.getGid());
            }

        } catch (Exception e) {
            log.error("Error handling BitTorrent download completion for GID: {}", status.getGid(), e);

            // Fallback: assume it's actual content and complete normally
            if (mirrorStatus != null) {
                statusService.logAndAppendHtml(mirrorStatus, "✅ Torrent download completed", false);
                mirrorHelper.postDownloadTasks(mirrorStatus.getId());
            }
            mappingService.removeMapping(status.getGid());
        }
    }

    private void handleTorrentMetadataCompletion(String metadataGid, Aria2StatusParam status, MirrorStatus mirrorStatus) {
        try {
            String mirrorId = mirrorStatus != null ? mirrorStatus.getId() : null;

            List<String> followedBy = status.getFollowedBy();

            if (followedBy != null && !followedBy.isEmpty()) {

                String actualGid = followedBy.get(0);
                log.info("Found actual download GID {} from origin gid: {}", actualGid, metadataGid);

                // Remove the metadata GID mapping
                mappingService.removeMapping(metadataGid);

                statusService.logAndAppendHtml(mirrorStatus, "📥 Torrent metadata downloaded, starting actual download...", false);

                mappingService.addMappingToActiveDownloads(mirrorId, actualGid);
                log.info("Mapped actual download GID: {} to mirror: {}", actualGid, mirrorId);

                // Request initial status for the actual download
                startDownloadMonitoring(actualGid, mirrorId);
            }

        } catch (Exception e) {
            log.error("Error handling torrent metadata completion for GID: {}", metadataGid, e);

            if (mirrorStatus != null) {
                statusService.logAndAppendHtml(mirrorStatus, "❌ Error processing torrent download", true);
            }
            mappingService.removeMapping(metadataGid);
        }
    }
}