package com.db.dbworld.services.aria2;

import com.db.dbworld.helpers.MirrorHelper;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.mirror.StatusService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.*;
import org.springframework.web.socket.client.WebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Paths;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.StreamSupport;

@Log4j2
@Service
@RequiredArgsConstructor
@EnableScheduling
public class Aria2WebSocketClientService {

    @Autowired
    private final StatusService statusService;
    private final MirrorHelper mirrorHelper;
    private final ObjectMapper objectMapper;
    private final WebSocketClient webSocketClient;

    @Value("${aria2.ws.url}")
    private String aria2WsUrl;

    @Value("${aria2.rpc.secret}")
    private String rpcSecret;

    private WebSocketSession session;
    private final AtomicBoolean isConnected = new AtomicBoolean(false);
    private final Map<String, String> activeDownloads = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        new Thread(() -> {
            int retries = 0;
            while (!isConnected.get()) {
                try {
                    connectToAria2();
                    break;
                } catch (Exception e) {
                    long wait = Math.min(1000L * (1L << retries), 10000L);
                    log.warn("WebSocket connection failed (attempt {}), retrying in {}ms...", retries + 1, wait, e);
                    retries++;
                    try {
                        Thread.sleep(wait);
                    } catch (InterruptedException ignored) {
                        Thread.currentThread().interrupt();
                    }
                }
            }
        }, "Aria2WebSocketConnector").start();
    }

    private boolean isSessionOpen() {
        return isConnected.get() && session != null && session.isOpen();
    }

    private void connectToAria2() throws Exception {
        URI uri = new URI(aria2WsUrl);
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();

        this.session = webSocketClient.execute(new TextWebSocketHandler() {
            @Override
            public void afterConnectionEstablished(WebSocketSession session) {
                isConnected.set(true);
                log.debug("✅ Connected to Aria2 WebSocket");
            }

            @Override
            public void handleTextMessage(WebSocketSession session, TextMessage message) {
                String payload = message.getPayload().trim();
                if (payload.isEmpty() || payload.equals("[]")) return;

                try {
                    JsonNode json = objectMapper.readTree(payload);
                    if (json.has("method")) handleNotification(json);
                    else if (json.has("result")) handleResponse(json);
                } catch (Exception e) {
                    log.error("Error processing WebSocket message", e);
                }
            }

            private void handleNotification(JsonNode json) {
                String method = json.path("method").asText();
                JsonNode params = json.path("params");
                String gid = params.get(0).path("gid").asText();

                switch (method) {
                    case "aria2.onDownloadStart" -> handleDownloadStart(gid);
                    case "aria2.onDownloadComplete", "aria2.onDownloadError", "aria2.onBtDownloadComplete" -> {
                        log.info("📦 Aria2 Event: {} for GID {}", method, gid);
                        requestFinalStatus(gid);
                    }
                    default -> log.debug("📨 Received {} for GID {}", method, gid);
                }
            }

            private void handleDownloadStart(String gid) {
                ObjectNode request = objectMapper.createObjectNode();
                request.put("jsonrpc", "2.0");
                request.put("id", "info-" + gid);
                request.put("method", "aria2.tellStatus");

                ArrayNode params = request.putArray("params");
                params.add("token:" + rpcSecret);
                params.add(gid);
                params.addArray().add("bittorrent").add("files");

                try {
                    session.sendMessage(new TextMessage(request.toString()));
                } catch (IOException e) {
                    log.error("Failed to request initial info for GID: {}", gid, e);
                }
            }

            private void handleResponse(JsonNode json) {
                String id = json.path("id").asText();
                JsonNode result = json.path("result");

                if (id.startsWith("info-")) {
                    handleInitialInfoResponse(id.substring(5), result);
                } else if (id.startsWith("status-") || id.startsWith("poll-")) {
                    updateMirrorStatus(id.replaceFirst("^(status|poll)-", ""), result);
                }
            }

            private void handleInitialInfoResponse(String gid, JsonNode result) {
                String mirrorId = activeDownloads.get(gid);
                if (mirrorId == null) return;

                MirrorStatus mirrorStatus = statusService.getStatusById(mirrorId);
                if (mirrorStatus == null) return;

                boolean updated = false;

                try {
                    String url = mirrorStatus.getFileUrl();

                    // ✅ Skip HTTPS/HTTP links – already have name
                    if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) {
                        return;
                    }

                    // ✅ Try to get name from .torrent info
                    JsonNode torrentNode = result.path("bittorrent").path("info").path("name");
                    if (!torrentNode.isMissingNode() && !torrentNode.asText().isBlank()) {
                        String torrentName = torrentNode.asText();
                        if (mirrorStatus.getFileName() == null || mirrorStatus.getFileName().isBlank()) {
                            mirrorStatus.setFileName(torrentName);
                            log.info("🎯 Set torrent name from Aria2 response: {}", torrentName);
                            updated = true;
                        }
                    }

                    // ✅ If file list is present, check first file name or folder size
                    ArrayNode files = (ArrayNode) result.path("files");
                    if (files != null && !files.isEmpty()) {
                        if (files.size() == 1) {
                            String filePath = files.get(0).path("path").asText();
                            String actualFileName = Paths.get(filePath).getFileName().toString();
                            if (mirrorStatus.getFileName() == null || mirrorStatus.getFileName().isBlank()) {
                                mirrorStatus.setFileName(actualFileName);
                                log.info("📄 Set single file name from files array: {}", actualFileName);
                                updated = true;
                            }
                        } else {
                            long totalSize = StreamSupport.stream(files.spliterator(), false)
                                    .mapToLong(f -> f.path("length").asLong())
                                    .sum();
                            if (mirrorStatus.getFileSize() != totalSize) {
                                mirrorStatus.setFileSize(totalSize);
                                log.info("📁 Set folder total size: {} bytes", totalSize);
                                updated = true;
                            }
                        }
                    }

                    if (updated) {
                        statusService.updateStatus(mirrorStatus);
                    }

                } catch (Exception e) {
                    log.error("❌ Failed to process initial info for GID {} → {}", gid, e.getMessage(), e);
                }
            }

            @Override
            public void handleTransportError(WebSocketSession session, Throwable exception) {
                log.debug("WebSocket transport error", exception);
                isConnected.set(false);
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
                log.debug("WebSocket closed: {}. Reconnecting...", status);
                isConnected.set(false);
                new Thread(() -> {
                    try {
                        Thread.sleep(3000);
                        init();
                    } catch (InterruptedException ignored) {}
                }).start();
            }

        }, headers, uri).get();
    }

    private void requestFinalStatus(String gid) {
        if (!isSessionOpen()) return;

        ObjectNode request = objectMapper.createObjectNode();
        request.put("jsonrpc", "2.0");
        request.put("id", "status-" + gid);
        request.put("method", "aria2.tellStatus");

        ArrayNode params = request.putArray("params");
        params.add("token:" + rpcSecret);
        params.add(gid);

        try {
            session.sendMessage(new TextMessage(request.toString()));
        } catch (IOException e) {
            log.error("Failed to request final status for GID: {}", gid, e);
        }
    }

    public void startDownloadMonitoring(String gid, String mirrorId) {
        activeDownloads.put(gid, mirrorId);
        MirrorStatus mirrorStatus = statusService.getStatusById(mirrorId);
        if (mirrorStatus != null) {
            mirrorStatus.setGid(gid);
            statusService.updateStatus(mirrorStatus);
        }
        log.info("🔍 Started monitoring GID {} for mirror {}", gid, mirrorId);
    }

    public void stopMonitoring(String gid) {
        String mirrorId = activeDownloads.remove(gid);
        if (mirrorId != null) {
            log.info("⏹️ Stopped monitoring GID {} for mirror {}", gid, mirrorId);
        }
    }

    @Scheduled(fixedRate = 3000)
    public void pollActiveDownloadStatus() {
        if (!isSessionOpen()) return;

        activeDownloads.forEach((gid, mirrorId) -> {
            ObjectNode request = objectMapper.createObjectNode();
            request.put("jsonrpc", "2.0");
            request.put("id", "poll-" + gid);
            request.put("method", "aria2.tellStatus");

            ArrayNode params = request.putArray("params");
            params.add("token:" + rpcSecret);
            params.add(gid);

            try {
                session.sendMessage(new TextMessage(request.toString()));
            } catch (IOException e) {
                log.error("Failed to poll status for GID: {}", gid, e);
            }
        });
    }

    @Scheduled(fixedDelay = 25000)
    public void sendKeepAlive() {
        if (isSessionOpen()) {
            try {
                ObjectNode request = objectMapper.createObjectNode();
                request.put("jsonrpc", "2.0");
                request.put("id", "keepalive");
                request.put("method", "aria2.getGlobalStat");
                request.putArray("params").add("token:" + rpcSecret);

                session.sendMessage(new TextMessage(request.toString()));
                log.debug("📶 Sent keep-alive ping");
            } catch (IOException e) {
                log.error("Failed to send keep-alive", e);
                isConnected.set(false);
            }
        }
    }

    @Scheduled(fixedRate = 30000)
    public void checkConnection() {
        if (!isConnected.get()) {
            log.warn("🔌 WebSocket disconnected. Reconnecting...");
            init();
        }
    }

    private void updateMirrorStatus(String gid, JsonNode status) {
        String mirrorId = activeDownloads.get(gid);
        if (mirrorId == null) return;

        String statusText = status.path("status").asText();
        long downloaded = status.path("completedLength").asLong();
        long total = status.path("totalLength").asLong();
        long speed = status.path("downloadSpeed").asLong();
        long eta = (speed > 0) ? (total - downloaded) / speed : -1;

        // Metadata-only check
        if (isMetadataOnly(status, downloaded, total)) {
            log.info("⚠️ Ignoring metadata-only download for {}", mirrorId);
            if ("complete".equals(statusText)) {
                handleMetadataCompletion(gid, mirrorId, status);
            }
            return;
        }

        downloaded = Math.min(downloaded, total);
        double progress = (total > 0) ? Math.min(100.0, ((double) downloaded / total) * 100) : 0;

        MirrorStatus.DownloadStatus downloadStatus = new MirrorStatus.DownloadStatus(
                (double) speed, eta, downloaded, total
        );

        try {
            switch (statusText) {
                case "complete" -> handleCompleteStatus(mirrorId, gid, downloadStatus);
                case "error" -> handleErrorStatus(mirrorId, gid, status);
                case "paused" -> handlePausedStatus(mirrorId, downloadStatus);
                case "waiting", "active" ->
                        handleActiveStatus(mirrorId, gid, downloadStatus, total, downloaded, progress);
                case "removed" -> handleCancelledStatus(mirrorId, gid);
                default -> log.warn("⚠️ Unknown status '{}' for mirror {}", statusText, mirrorId);
            }
        } catch (Exception e) {
            log.error("🚨 Failed to update status for {}", mirrorId, e);
        }
    }


    // Helper methods for each status case
    private void handleMetadataCompletion(String gid, String mirrorId, JsonNode status) {
        if (status.has("followedBy")) {
            ArrayNode followedBy = (ArrayNode) status.path("followedBy");
            if (!followedBy.isEmpty()) {
                String realGid = followedBy.get(0).asText();
                activeDownloads.put(realGid, mirrorId);

                MirrorStatus mirrorStatus = statusService.getStatusById(mirrorId);
                if (mirrorStatus != null) {
                    mirrorStatus.setGid(realGid);
                    statusService.updateStatus(mirrorStatus);
                    log.info("🔄 Found follow-up GID {} for mirror {}", realGid, mirrorId);
                }
            }
        }
        activeDownloads.remove(gid);
    }

    private void handleCompleteStatus(String mirrorId, String gid,
                                      MirrorStatus.DownloadStatus downloadStatus) {
        statusService.updateMirrorStatusWithDownloadState(mirrorId, downloadStatus);
        activeDownloads.remove(gid);
        log.info("✅ Completed download for {}", mirrorId);
        mirrorHelper.postDownloadTasks(mirrorId);
    }

    private void handleErrorStatus(String mirrorId, String gid, JsonNode status) {
        String errorMessage = status.path("errorMessage").asText("Download failed");
        statusService.updateMirrorStatusWithFailed(mirrorId, errorMessage);
        activeDownloads.remove(gid);
        log.error("❌ Download failed for {}: {}", mirrorId, errorMessage);
    }

    private void handlePausedStatus(String mirrorId, MirrorStatus.DownloadStatus downloadStatus) {
        MirrorStatus mirrorStatus = statusService.getStatusById(mirrorId);
        if (!mirrorStatus.isPause()) {
            statusService.updateMirrorStatusWithDownloadState(mirrorId, downloadStatus);
            statusService.updateMirrorStatusWithPause(mirrorId);
            log.info("⏸️ Download paused for {}", mirrorId);
        } else {
            // Optional: update progress while paused
            statusService.updateMirrorStatusWithDownloadState(mirrorId, downloadStatus);
        }
    }

    private void handleActiveStatus(String mirrorId, String gid,
                                    MirrorStatus.DownloadStatus downloadStatus,
                                    long total, long downloaded, double progress) {

        MirrorStatus mirrorStatus = statusService.getStatusById(mirrorId);
        if (mirrorStatus == null) {
            activeDownloads.remove(gid);
            log.warn("⚠️ Mirror status not found for active GID {} (mirror {})", gid, mirrorId);
            return;
        }

        // Store original file info
        String originalFileName = mirrorStatus.getFileName();
        String originalFilePath = mirrorStatus.getFilePath();

        // Always update download status
        statusService.updateMirrorStatusWithDownloadState(mirrorId, downloadStatus);

        // Update size if changed
        if (total > 0 && mirrorStatus.getFileSize() != total) {
            mirrorStatus.setFileSize(total);
            mirrorStatus.setFileName(originalFileName); // restore
            mirrorStatus.setFilePath(originalFilePath);
            statusService.updateStatus(mirrorStatus);
        }

        // Resume handling
        if (mirrorStatus.isPause()) {
            statusService.updateMirrorStatusWithResume(mirrorId);
            log.info("▶️ Download resumed for {} (filename: {})", mirrorId, originalFileName);
        }

        if (log.isDebugEnabled()) {
            log.debug("⬇️ {} - {} / {} ({}%)", mirrorId, downloaded, total,
                    String.format("%.1f", progress));
        }
    }

    private void handleCancelledStatus(String mirrorId, String gid) {
        statusService.updateMirrorStatusWithCancelled(mirrorId);
        activeDownloads.remove(gid);
        log.info("⏹️ Download cancelled for {}", mirrorId);
    }

    private boolean isMetadataOnly(JsonNode status, long downloaded, long total) {
        // Check for [METADATA] in filename (most reliable indicator)
        if (status.has("files")) {
            ArrayNode files = (ArrayNode) status.path("files");
            if (!files.isEmpty()) {
                String path = files.get(0).path("path").asText("");
                if (path.contains("[METADATA]")) {
                    return true;
                }
            }
        }

        // Check for torrent metadata flag and small size
        if (status.has("bittorrent")) {
            // Very small files with few pieces are likely metadata
            if (status.path("numPieces").asInt() <= 1 && total < 100_000) {
                return true;
            }

            // Check if this is followed by another download
            if (status.has("followedBy")) {
                return true;
            }
        }

        // Check for small completed downloads that might be metadata
        return total < 100_000 && downloaded == total;
    }
}