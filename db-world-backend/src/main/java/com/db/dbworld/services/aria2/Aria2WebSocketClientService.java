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
import java.nio.file.Path;
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
                        statusService.logAndAppendHtml(getMirrorStatusForGid(gid), "📦 Aria2 Event: " + method + " for GID " + gid, false);
                        requestFinalStatus(gid);
                    }
                    default -> statusService.logAndAppendHtml(null, "📨 Received " + method + " for GID " + gid, false);
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
                    statusService.logAndAppendHtml(getMirrorStatusForGid(gid), "Failed to request initial info for GID: " + gid, true);
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

            public void handleInitialInfoResponse(String gid, JsonNode result) {
                String mirrorId = activeDownloads.get(gid);
                if (mirrorId == null) return;

                MirrorStatus mirrorStatus = statusService.getStatusById(mirrorId);
                if (mirrorStatus == null || !mirrorStatus.isMagnet()) return;

                try {
                    boolean updated = processTorrentInfo(result, mirrorStatus)
                            | processFilesInfo(result, mirrorStatus);

                    if (updated) {
                        statusService.updateStatus(mirrorStatus);
                    }
                } catch (Exception e) {
                    statusService.logAndAppendHtml(mirrorStatus, "Failed to process initial info for GID " + gid + " → " + e.getMessage(), true);
                }
            }

            private boolean processTorrentInfo(JsonNode result, MirrorStatus mirrorStatus) {
                JsonNode torrentNode = result.path("bittorrent").path("info").path("name");
                if (torrentNode.isMissingNode() || torrentNode.asText().isBlank()) {
                    return false;
                }

                String torrentName = torrentNode.asText();
                if (mirrorStatus.isMagnet()) {
                    mirrorStatus.setFileName(torrentName);
                    mirrorStatus.setTempFileName(torrentName);
                    statusService.logAndAppendHtml(mirrorStatus, "Set torrent name from response: " + torrentName, false);
                    return true;
                }
                return false;
            }

            private boolean processFilesInfo(JsonNode result, MirrorStatus mirrorStatus) {
                ArrayNode files = (ArrayNode) result.path("files");
                if (files == null || files.isEmpty()) {
                    return false;
                }

                return files.size() == 1
                        ? processSingleFile(files.get(0), mirrorStatus)
                        : processMultipleFiles(files, mirrorStatus);
            }

            private boolean processSingleFile(JsonNode file, MirrorStatus mirrorStatus) {
                boolean updated = false;
                String filePath = file.path("path").asText();
                String actualFileName = Paths.get(filePath).getFileName().toString();

                if (mirrorStatus.isMagnet()) {
                    mirrorStatus.setFileName(actualFileName);
                    mirrorStatus.setTempFileName(actualFileName);
                    statusService.logAndAppendHtml(mirrorStatus, "Set single file name: " + actualFileName, false);
                    updated = true;
                }

                long fileSize = file.path("length").asLong();
                if (mirrorStatus.getFileSize() != fileSize) {
                    mirrorStatus.setFileSize(fileSize);
                    statusService.logAndAppendHtml(mirrorStatus, "Set single file size: " + fileSize + " bytes", false);
                    updated = true;
                }

                return updated;
            }

            private boolean processMultipleFiles(ArrayNode files, MirrorStatus mirrorStatus) {
                boolean updated = false;

                // Calculate total size
                long totalSize = StreamSupport.stream(files.spliterator(), false)
                        .mapToLong(f -> f.path("length").asLong())
                        .sum();

                if (mirrorStatus.getFileSize() != totalSize) {
                    mirrorStatus.setFileSize(totalSize);
                    statusService.logAndAppendHtml(mirrorStatus, "Set folder total size: " + totalSize + " bytes", false);
                    updated = true;
                }

                // Set folder name
                String firstFilePath = files.get(0).path("path").asText();
                Path parentFolder = Paths.get(firstFilePath).getParent();
                if (parentFolder != null && mirrorStatus.isMagnet()) {
                    String folderName = parentFolder.getFileName().toString();
                    mirrorStatus.setFileName(folderName);
                    mirrorStatus.setTempFileName(folderName);
                    statusService.logAndAppendHtml(mirrorStatus, "Set folder name: " + folderName, false);
                    updated = true;
                }

                return updated;
            }

            @Override
            public void handleTransportError(WebSocketSession session, Throwable exception) {
                statusService.logAndAppendHtml(null, "WebSocket transport error: " + exception.getMessage(), true);
                isConnected.set(false);
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
                statusService.logAndAppendHtml(null, "WebSocket closed: " + status + ". Reconnecting...", false);
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
            statusService.logAndAppendHtml(getMirrorStatusForGid(gid), "Failed to request final status for GID: " + gid, true);
        }
    }

    public void startDownloadMonitoring(String gid, String mirrorId) {
        activeDownloads.put(gid, mirrorId);
        MirrorStatus mirrorStatus = statusService.getStatusById(mirrorId);
        if (mirrorStatus != null) {
            mirrorStatus.setGid(gid);
            statusService.updateStatus(mirrorStatus);
        }
        statusService.logAndAppendHtml(mirrorStatus, "🔍 Started monitoring GID " + gid + " for mirror " + mirrorId, false);
    }

    public void stopMonitoring(String gid) {
        String mirrorId = activeDownloads.remove(gid);
        if (mirrorId != null) {
            statusService.logAndAppendHtml(statusService.getStatusById(mirrorId), "⏹️ Stopped monitoring GID " + gid + " for mirror " + mirrorId, false);
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
                statusService.logAndAppendHtml(statusService.getStatusById(mirrorId), "Failed to poll status for GID: " + gid, true);
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

        MirrorStatus mirrorStatus = statusService.getStatusById(mirrorId);
        if (mirrorStatus == null) return;

        String statusText = status.path("status").asText();
        long downloaded = status.path("completedLength").asLong();
        long total = status.path("totalLength").asLong();
        long speed = status.path("downloadSpeed").asLong();
        long eta = (speed > 0) ? (total - downloaded) / speed : -1;

        // Metadata-only check
        if (isMetadataOnly(status, downloaded, total)) {
            statusService.logAndAppendHtml(mirrorStatus, "⚠️ Ignoring metadata-only download", false);
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
                default -> statusService.logAndAppendHtml(mirrorStatus, "⚠️ Unknown status '" + statusText + "'", true);
            }
        } catch (Exception e) {
            statusService.logAndAppendHtml(mirrorStatus, "🚨 Failed to update status: " + e.getMessage(), true);
        }
    }

    private MirrorStatus getMirrorStatusForGid(String gid) {
        String mirrorId = activeDownloads.get(gid);
        return mirrorId != null ? statusService.getStatusById(mirrorId) : null;
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
                    statusService.logAndAppendHtml(mirrorStatus, "🔄 Found follow-up GID " + realGid, false);
                }
            }
        }
        activeDownloads.remove(gid);
    }

    private void handleCompleteStatus(String mirrorId, String gid,
                                      MirrorStatus.DownloadStatus downloadStatus) {
        MirrorStatus mirrorStatus = statusService.getStatusById(mirrorId);
        statusService.updateMirrorStatusWithDownloadState(mirrorId, downloadStatus);
        activeDownloads.remove(gid);
        statusService.logAndAppendHtml(mirrorStatus, "✅ Completed download", false);
        mirrorHelper.postDownloadTasks(mirrorId);
    }

    private void handleErrorStatus(String mirrorId, String gid, JsonNode status) {
        MirrorStatus mirrorStatus = statusService.getStatusById(mirrorId);
        String errorMessage = status.path("errorMessage").asText("Download failed");
        statusService.updateMirrorStatusWithFailed(mirrorId, errorMessage);
        activeDownloads.remove(gid);
        statusService.logAndAppendHtml(mirrorStatus, "❌ Download failed: " + errorMessage, true);
    }

    private void handlePausedStatus(String mirrorId, MirrorStatus.DownloadStatus downloadStatus) {
        MirrorStatus mirrorStatus = statusService.getStatusById(mirrorId);
        if (!mirrorStatus.isPause()) {
            statusService.updateMirrorStatusWithDownloadState(mirrorId, downloadStatus);
            statusService.updateMirrorStatusWithPause(mirrorId);
            statusService.logAndAppendHtml(mirrorStatus, "⏸️ Download paused", false);
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
            statusService.logAndAppendHtml(null, "⚠️ Mirror status not found for active GID " + gid + " (mirror " + mirrorId + ")", true);
            return;
        }

        // Always update download status
        statusService.updateMirrorStatusWithDownloadState(mirrorId, downloadStatus);

        // Update size if changed
        if (total > 0 && mirrorStatus.getFileSize() != total) {
            mirrorStatus.setFileSize(total);
            statusService.updateStatus(mirrorStatus);
        }

        // Resume handling
        if (mirrorStatus.isPause()) {
            statusService.updateMirrorStatusWithResume(mirrorId);
            statusService.logAndAppendHtml(mirrorStatus, "▶️ Download resumed", false);
        }

        if (log.isDebugEnabled()) {
            log.debug("⬇️ {} - {} / {} ({}%)", mirrorId, downloaded, total,
                    String.format("%.1f", progress));
        }
    }

    private void handleCancelledStatus(String mirrorId, String gid) {
        MirrorStatus mirrorStatus = statusService.getStatusById(mirrorId);
        statusService.updateMirrorStatusWithCancelled(mirrorId);
        activeDownloads.remove(gid);
        statusService.logAndAppendHtml(mirrorStatus, "⏹️ Download cancelled", false);
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