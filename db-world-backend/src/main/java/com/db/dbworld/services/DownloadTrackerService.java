package com.db.dbworld.services;

import com.db.dbworld.dao.user.UserCinemaDataRepository;
import com.db.dbworld.entities.user.UserCinemaDataEntity;
import com.db.dbworld.services.user.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Getter;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.nio.channels.Channels;
import java.nio.channels.FileChannel;
import java.nio.file.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Pattern;

@Log4j2
@Service
@Getter
public class DownloadTrackerService {
    // Constants
    private static final DateTimeFormatter LOG_DATE_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int INACTIVITY_THRESHOLD_MIN = 30;
    private static final int BROADCAST_INTERVAL_MS = 5000;
    private static final int LOG_PROCESSING_INTERVAL_MS = 15000;
    private static final int MAX_LOG_ENTRIES_TO_CACHE = 10000;
    private static final int PAUSE_DETECTION_MINUTES = 5;

    // Compiled regex patterns for field extraction
    private static final Pattern DOWNLOAD_ID_PATTERN =
            Pattern.compile("\"download_id\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern USER_ID_PATTERN =
            Pattern.compile("\"user_id\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern FILE_PATH_PATTERN =
            Pattern.compile("\"file_path\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern BYTES_TRANSFERRED_PATTERN =
            Pattern.compile("\"bytes_transferred\"\\s*:\\s*(\\d+)");
    private static final Pattern FILE_SIZE_PATTERN =
            Pattern.compile("\"file_size\"\\s*:\\s*(\\d+)");
    private static final Pattern EVENT_TYPE_PATTERN =
            Pattern.compile("\"event_type\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern STATUS_PATTERN =
            Pattern.compile("\"status\"\\s*:\\s*\"([^\"]+)\"");

    // Dependencies
    private final UserCinemaDataRepository repo;
    private final UserService userService;
    private final ObjectMapper mapper;

    // Tracking state
    private final Map<String, DownloadStatus> activeTransfers = new ConcurrentHashMap<>();
    private final Set<WebSocketSession> sessions = Collections.synchronizedSet(new HashSet<>());
    private final AtomicLong lastFilePosition = new AtomicLong(0);
    private final Map<String, AtomicLong> fileTransferProgress = new ConcurrentHashMap<>();
    private final Set<String> processedEntryHashes = Collections.synchronizedSet(new LinkedHashSet<>() {
        @Override
        public boolean add(String e) {
            boolean result = super.add(e);
            if (size() > MAX_LOG_ENTRIES_TO_CACHE) {
                remove(iterator().next());
            }
            return result;
        }
    });

    @Value("${dbworld.paths.downloadLogPath}")
    private String logFilePath;

    public DownloadTrackerService(UserCinemaDataRepository repo, UserService userService, ObjectMapper mapper) {
        this.repo = repo;
        this.userService = userService;
        this.mapper = mapper;
    }

    // WebSocket Management
    public void addSession(WebSocketSession session) {
        sessions.add(session);
        sendInitialData(session);
    }

    public void removeSession(WebSocketSession session) {
        sessions.remove(session);
    }

    @Scheduled(fixedRate = BROADCAST_INTERVAL_MS)
    public void broadcastUpdate() {
        if (sessions.isEmpty()) return;
        String message = buildStatusMessage();
        sessions.forEach(session -> sendMessage(session, message));
    }

    @Scheduled(fixedRate = LOG_PROCESSING_INTERVAL_MS)
    public void processLogs() {
        try {
            processLogFile();
            cleanupInactiveTransfers();
            detectPausedDownloads();
        } catch (Exception e) {
            log.error("Log processing error", e);
        }
    }

    private void detectPausedDownloads() {
        Instant pauseThreshold = Instant.now().minus(Duration.ofMinutes(PAUSE_DETECTION_MINUTES));
        activeTransfers.values().stream()
                .filter(status -> status.getLastSeen().isBefore(pauseThreshold))
                .forEach(status -> updateDownloadStatus(status.getDownloadId(), UserCinemaDataEntity.Status.PAUSED));
    }

    private void processLogFile() throws IOException {
        Path path = Path.of(logFilePath);
        if (!Files.exists(path)) return;

        try (FileChannel channel = FileChannel.open(path, StandardOpenOption.READ)) {
            long fileSize = channel.size();
            long position = lastFilePosition.get();

            if (position > fileSize) {
                position = 0;
                processedEntryHashes.clear();
            }

            if (position == fileSize) return;

            try (Scanner scanner = new Scanner(Channels.newInputStream(channel.position(position)))) {
                while (scanner.hasNextLine()) {
                    processLogEntry(scanner.nextLine().trim());
                }
                lastFilePosition.set(channel.position());
            }
        }
    }

    private void processLogEntry(String json) {
        if (json == null || json.trim().isEmpty()) return;

        try {
            // First attempt with direct parsing
            Map<String, Object> data = mapper.readValue(json, Map.class);
            handleValidEntry(data, json);
        } catch (Exception e) {
            try {
                // Attempt with repaired JSON
                Map<String, Object> data = mapper.readValue(repairMalformedJson(json), Map.class);
                handleValidEntry(data, json);
            } catch (Exception ex) {
                log.warn("Failed to parse log entry after repair. Entry: {}", json);
                processWithMinimalDataExtraction(json);
            }
        }
    }

    private void processWithMinimalDataExtraction(String json) {
        try {
            Map<String, Object> minimalData = extractCriticalFields(json);
            if (minimalData != null && isValidMinimalEntry(minimalData)) {
                handleValidEntry(minimalData, json);
                log.debug("Processed via manual field extraction");
            } else {
                log.warn("Skipping unprocessable entry: {}", json);
            }
        } catch (Exception ex) {
            log.warn("Field extraction failed for entry: {}", json);
        }
    }

    private Map<String, Object> extractCriticalFields(String json) {
        Map<String, Object> data = new HashMap<>();

        extractField(json, DOWNLOAD_ID_PATTERN, "download_id", data);
        extractField(json, USER_ID_PATTERN, "user_id", data);
        extractField(json, FILE_PATH_PATTERN, "file_path", data);
        extractNumericField(json, BYTES_TRANSFERRED_PATTERN, "bytes_transferred", data);
        extractNumericField(json, FILE_SIZE_PATTERN, "file_size", data);
        extractField(json, EVENT_TYPE_PATTERN, "event_type", data);
        extractField(json, STATUS_PATTERN, "status", data);

        return data;
    }

    private void extractField(String json, Pattern pattern, String fieldName, Map<String, Object> data) {
        pattern.matcher(json).results().findFirst().ifPresent(match -> data.put(fieldName, match.group(1)));
    }

    private void extractNumericField(String json, Pattern pattern, String fieldName, Map<String, Object> data) {
        pattern.matcher(json).results().findFirst().ifPresent(match -> {
            try {
                data.put(fieldName, Long.parseLong(match.group(1)));
            } catch (NumberFormatException e) {
                log.debug("Failed to parse numeric field {}: {}", fieldName, match.group(1));
            }
        });
    }

    private boolean isValidMinimalEntry(Map<String, Object> data) {
        return data.containsKey("download_id") &&
                data.containsKey("user_id") &&
                data.containsKey("file_path");
    }

    private void handleValidEntry(Map<String, Object> data, String rawEntry) {
        if (!isDownloadEvent(toString(data.get("event_type")))) return;

        String filePath = toString(data.get("file_path")).replace(" ", "");
        data.put("file_path", filePath);
        updateTransferStatus(data, rawEntry);
    }

    private boolean isDownloadEvent(String eventType) {
        return "DOWNLOAD".equalsIgnoreCase(eventType) ||
                "PARTIAL".equalsIgnoreCase(eventType) ||
                "COMPLETE".equalsIgnoreCase(eventType);
    }

    private void updateTransferStatus(Map<String, Object> data, String rawEntry) {
        DownloadStatus status = createDownloadStatus(data);
        String progressKey = status.getUserId() + "|" + status.getFileName();

        updateProgressTracker(progressKey, status.getBytesTransferred());
        activeTransfers.put(status.getDownloadId(), status);

        if (shouldCompleteTransfer(status)) {
            completeTransfer(status, rawEntry);
            fileTransferProgress.remove(progressKey);
            activeTransfers.remove(status.getDownloadId());
        } else {
            updateInProgressDownload(status);
        }
    }

    private DownloadStatus createDownloadStatus(Map<String, Object> data) {
        DownloadStatus status = new DownloadStatus();
        status.setDownloadId(toString(data.get("download_id")));
        status.setUserId(toString(data.get("user_id")));
        status.setFileName(Path.of(toString(data.get("file_path"))).getFileName().toString());
        status.setFilePath(toString(data.get("file_path")));
        status.setFileSize(parseLong(data.get("file_size")));
        status.setBytesTransferred(parseLong(data.get("bytes_transferred")));
        status.setLastSeen(parseTimestamp(toString(data.get("time"))));
        status.setStatusCode(toString(data.get("status")));
        return status;
    }

    private void updateProgressTracker(String progressKey, long bytesTransferred) {
        fileTransferProgress.compute(progressKey, (k, v) ->
                (v == null || bytesTransferred > v.get()) ?
                        new AtomicLong(bytesTransferred) : v
        );
    }

    private boolean shouldCompleteTransfer(DownloadStatus status) {
        if (repo.existsByDownloadIdAndStatus(status.getDownloadId(), UserCinemaDataEntity.Status.COMPLETED)) {
            return false;
        }

//        if ("COMPLETE".equalsIgnoreCase(status.getStatus()) || "200".equals(status.getStatusCode())) {
//            return true;
//        }

        String progressKey = status.getUserId() + "|" + status.getFileName();
        long currentProgress = fileTransferProgress.getOrDefault(progressKey, new AtomicLong(0)).get();
        return status.getFileSize() > 0 &&
                (status.getBytesTransferred() >= status.getFileSize() || currentProgress >= status.getFileSize());
    }

    private void completeTransfer(DownloadStatus status, String rawEntry) {
        String entryHash = hashEntry(rawEntry);
        if (processedEntryHashes.contains(entryHash)) return;

        try {
            repo.findByDownloadIdAndStatus(status.getDownloadId(), UserCinemaDataEntity.Status.COMPLETED)
                    .ifPresentOrElse(
                            entity -> processedEntryHashes.add(entryHash),
                            () -> createOrUpdateDownloadRecord(status, entryHash)
                    );
        } catch (Exception e) {
            log.error("Failed to complete transfer tracking", e);
        }
    }

    private void createOrUpdateDownloadRecord(DownloadStatus status, String entryHash) {
        UserCinemaDataEntity entity = repo.findByDownloadId(status.getDownloadId())
                .map(existing -> {
                    if (existing.getStatus() != UserCinemaDataEntity.Status.COMPLETED) {
                        existing.markCompleted();
                        existing.setBytesTransferred(status.getBytesTransferred());
                    }
                    return existing;
                })
                .orElseGet(() -> createNewEntity(status));

        if (entity.getStatus() != UserCinemaDataEntity.Status.COMPLETED) {
            repo.save(entity);
            processedEntryHashes.add(entryHash);
            log.info("Download completed: {} - {} ({} bytes)",
                    status.getUserId(), status.getFileName(), status.getBytesTransferred());
        }
    }

    private UserCinemaDataEntity createNewEntity(DownloadStatus status) {
        UserCinemaDataEntity entity = new UserCinemaDataEntity();
        entity.setUser(userService.getUserEntityByEmail(status.getUserId()));
        entity.setDownloadId(status.getDownloadId());
        entity.setEvent("DOWNLOAD");
        entity.setValue(status.getFileName());
        entity.setFilePath(status.getFilePath());
        entity.setFileSize(status.getFileSize());
        entity.setBytesTransferred(status.getBytesTransferred());
        entity.markCompleted();
        return entity;
    }

    private void updateInProgressDownload(DownloadStatus status) {
        try {
            repo.findByDownloadId(status.getDownloadId())
                    .ifPresentOrElse(
                            entity -> updateExistingEntity(entity, status),
                            () -> repo.save(createNewInProgressEntity(status))
                    );
        } catch (Exception e) {
            log.error("Failed to update in-progress download", e);
        }
    }

    private void updateExistingEntity(UserCinemaDataEntity entity, DownloadStatus status) {
        if (entity.getStatus() == UserCinemaDataEntity.Status.PAUSED) {
            entity.resume();
        }
        entity.setBytesTransferred(status.getBytesTransferred());
        entity.setLastActivity(Instant.now());
        repo.save(entity);
    }

    private UserCinemaDataEntity createNewInProgressEntity(DownloadStatus status) {
        UserCinemaDataEntity entity = new UserCinemaDataEntity();
        entity.setUser(userService.getUserEntityByEmail(status.getUserId()));
        entity.setDownloadId(status.getDownloadId());
        entity.setEvent("DOWNLOAD");
        entity.setValue(status.getFileName());
        entity.setFilePath(status.getFilePath());
        entity.setFileSize(status.getFileSize());
        entity.setBytesTransferred(status.getBytesTransferred());
        entity.setStatus(UserCinemaDataEntity.Status.IN_PROGRESS);
        return entity;
    }

    private void updateDownloadStatus(String downloadId, UserCinemaDataEntity.Status status) {
        repo.findByDownloadId(downloadId).ifPresent(entity -> {
            entity.setStatus(status);
            repo.save(entity);
            log.info("Marked download as {}: {}", status, downloadId);
        });
    }

    private String repairMalformedJson(String json) {
        if (!json.trim().startsWith("{")) {
            json = "{" + json;
        }

        if (!json.contains("\"user_id\"") && json.contains("\"download_id\"")) {
            json = json.replaceFirst("^\\{", "{\"user_id\":\"unknown\",");
        }

        return json.replaceAll("(:\\s*\\{)", "$1\"")
                .replaceAll("(\\}\"\\s*$)", "}")
                .replaceAll("(/[^\" ]*)\\s+", "$1")
                .replaceAll("\\\\/", "/")
                .replaceAll("\"\"", "\"")
                .replaceAll(",\\s*,", ",")
                .replaceAll("([\\w_]+)\\s*:", "\"$1\":");
    }

    private String hashEntry(String entry) {
        return Integer.toHexString(entry.hashCode());
    }

    private Instant parseTimestamp(String timestamp) {
        if (timestamp == null || timestamp.isEmpty()) return Instant.now();
        try {
            return Instant.parse(timestamp);
        } catch (Exception e) {
            try {
                return LocalDateTime.parse(timestamp, LOG_DATE_FORMATTER)
                        .atZone(ZoneId.systemDefault())
                        .toInstant();
            } catch (Exception ex) {
                log.warn("Failed to parse timestamp: {}", timestamp);
                return Instant.now();
            }
        }
    }

    private String buildStatusMessage() {
        try {
            Map<String, Object> response = new HashMap<>();
            response.put("activeDownloads", new ArrayList<>(activeTransfers.values()));
            response.put("statistics", calculateStatistics());
            response.put("userHistories", getUserHistories());
            return mapper.writeValueAsString(response);
        } catch (Exception e) {
            log.error("Failed to build status message", e);
            return "{\"error\":\"Failed to build status\"}";
        }
    }

    private Map<String, Object> calculateStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("activeUsers", activeTransfers.values().stream()
                .map(DownloadStatus::getUserId)
                .distinct()
                .count());
        stats.put("activeDownloads", activeTransfers.size());
        stats.put("totalBandwidth", formatBytes(activeTransfers.values().stream()
                .mapToLong(DownloadStatus::getBytesTransferred)
                .sum()));
        return stats;
    }

    private Map<String, List<Map<String, Object>>> getUserHistories() {
        Map<String, List<Map<String, Object>>> histories = new HashMap<>();
        repo.findTop10EventsPerExistingUser().forEach(entity -> {
            Map<String, Object> item = new HashMap<>();
            item.put("fileName", entity.getValue());
            item.put("status", entity.getStatus().toString());
            item.put("time", entity.getTime());
            item.put("bytesTransferred", entity.getBytesTransferred());
            histories.computeIfAbsent(entity.getUser().getEmail(), k -> new ArrayList<>()).add(item);
        });
        return histories;
    }

    private String formatBytes(long bytes) {
        if (bytes < 1024) return bytes + " B";
        int exp = (int)(Math.log(bytes) / Math.log(1024));
        String pre = "KMGTPE".charAt(exp-1) + "i";
        return String.format("%.1f %sB", bytes / Math.pow(1024, exp), pre);
    }

    private void sendMessage(WebSocketSession session, String message) {
        try {
            if (session.isOpen()) {
                synchronized (session) {
                    session.sendMessage(new TextMessage(message));
                }
            }
        } catch (IOException e) {
            log.warn("Failed to send WS message", e);
            removeSession(session);
        }
    }

    private void sendInitialData(WebSocketSession session) {
        sendMessage(session, buildStatusMessage());
    }

    private void cleanupInactiveTransfers() {
        Instant cutoff = Instant.now().minus(Duration.ofMinutes(INACTIVITY_THRESHOLD_MIN));
        activeTransfers.entrySet().removeIf(entry ->
                entry.getValue().getLastSeen().isBefore(cutoff));
    }

    private String toString(Object obj) {
        return obj != null ? obj.toString() : "";
    }

    private long parseLong(Object obj) {
        try {
            return Long.parseLong(toString(obj));
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

}