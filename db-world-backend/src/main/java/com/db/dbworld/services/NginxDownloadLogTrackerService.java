//package com.db.dbworld.services;
//
//import com.db.dbworld.dao.user.UserCinemaDataRepository;
//import com.db.dbworld.entities.user.UserCinemaDataEntity;
//import com.db.dbworld.services.user.UserService;
//import com.fasterxml.jackson.databind.ObjectMapper;
//import lombok.Getter;
//import lombok.extern.log4j.Log4j2;
//import org.springframework.beans.factory.annotation.Value;
//import org.springframework.scheduling.annotation.Scheduled;
//import org.springframework.stereotype.Service;
//
//import java.io.IOException;
//import java.net.URLDecoder;
//import java.nio.charset.StandardCharsets;
//import java.nio.file.Files;
//import java.nio.file.Path;
//import java.time.Instant;
//import java.time.LocalDateTime;
//import java.time.ZoneId;
//import java.time.format.DateTimeFormatter;
//import java.time.format.DateTimeParseException;
//import java.util.*;
//import java.util.concurrent.ConcurrentHashMap;
//import java.util.concurrent.atomic.AtomicInteger;
//import java.util.stream.Collectors;
//
//@Log4j2
//@Service
//@Getter
//public class NginxDownloadLogTrackerService {
//
//    private static final String BYTES_PREFIX = "bytes=";
//    private static final String JSON_START = "{";
//    private static final String JSON_END = "}";
//    private static final int FIVE_HOURS_IN_MS = 5 * 60 * 60 * 1000;
//    private static final long INACTIVITY_THRESHOLD_MS = 30000; // 30 seconds
//    private static final DateTimeFormatter LOG_DATE_FORMATTER =
//            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
//
//    private final UserCinemaDataRepository repo;
//    private final UserService userService;
//    private final ObjectMapper mapper = new ObjectMapper();
//    private final Map<String, DownloadStatus> cache = new ConcurrentHashMap<>();
//    private final Map<String, List<DownloadStatus>> userHistory = new ConcurrentHashMap<>();
//
//    @Value("${dbworld.paths.downloadLogPath}")
//    private String downloadLogPath;
//
//    public NginxDownloadLogTrackerService(
//            UserCinemaDataRepository repo,
//            UserService userService
//    ) {
//        this.repo = repo;
//        this.userService = userService;
//    }
//
//    @Scheduled(fixedDelay = 10000)
//    public void scanDownloadLogs() {
//        try {
//            String content = Files.readString(Path.of(downloadLogPath));
//            List<String> retainedEntries = processLogContent(content);
//            writeRetainedEntriesToLog(retainedEntries);
//            cleanupInactiveDownloads();
//        } catch (IOException e) {
//            log.error("Error reading/parsing log file: {}", e.getMessage(), e);
//        }
//    }
//
//    private List<String> processLogContent(String content) {
//        List<String> retainedEntries = new ArrayList<>();
//        AtomicInteger processedCount = new AtomicInteger();
//        AtomicInteger skippedCount = new AtomicInteger();
//
//        int startIdx = 0;
//        while ((startIdx = content.indexOf(JSON_START, startIdx)) != -1) {
//            int endIdx = content.indexOf(JSON_END, startIdx);
//            if (endIdx == -1) {
//                log.warn("Incomplete log entry found. Skipping rest.");
//                break;
//            }
//
//            String jsonFragment = content.substring(startIdx, endIdx + 1);
//            startIdx = endIdx + 1;
//
//            try {
//                processLogEntry(jsonFragment, retainedEntries);
//                processedCount.incrementAndGet();
//            } catch (Exception ex) {
//                skippedCount.incrementAndGet();
//                log.error("Failed to parse JSON log: {}", ex.getMessage(), ex);
//            }
//        }
//
//        log.debug("Processed={} Skipped={} Remaining={}",
//                processedCount.get(), skippedCount.get(), retainedEntries.size());
//        return retainedEntries;
//    }
//
//    private void processLogEntry(String jsonFragment, List<String> retainedEntries) throws IOException {
//        Map<String, Object> logData = mapper.readValue(jsonFragment, Map.class);
//
//        String downloadId = decode(toString(logData.get("download_id")));
//        String userId = decode(toString(logData.get("user_id")));
//        String filePath = decode(toString(logData.get("file_path")));
//        String fileName = Path.of(filePath).getFileName().toString();
//        String rangeStart = decode(toString(logData.get("range_start")));
//        long bytesSent = parseLongSafe(toString(logData.get("bytes_sent")));
//        long bytesTransferred = parseLongSafe(toString(logData.get("bytes_transferred")));
//        long fileSize = parseLongSafe(toString(logData.get("file_size")));
//        double duration = parseDoubleSafe(toString(logData.get("duration")));
//        String eventType = decode(toString(logData.get("event_type")));
//        String status = decode(toString(logData.get("status")));
//        String remoteAddr = decode(toString(logData.get("remote_addr")));
//        String userAgent = decode(toString(logData.get("user_agent")));
//        String timestamp = decode(toString(logData.get("time")));
//
//        long rangeStartVal = parseRangeStart(rangeStart);
//        long lastByteServed = rangeStartVal + bytesSent - 1;
//
//        DownloadStatus downloadStatus = cache.computeIfAbsent(downloadId, id ->
//                createNewDownloadStatus(
//                        downloadId, userId, fileName, filePath,
//                        fileSize, remoteAddr, userAgent
//                ));
//
//        // Update download status with new data
//        updateDownloadStatus(
//                downloadStatus, bytesSent, bytesTransferred,
//                duration, eventType, status, timestamp
//        );
//
//        if (isDownloadComplete(status, fileSize, lastByteServed)) {
//            handleCompleteDownload(downloadStatus);
//        } else {
//            retainedEntries.add(jsonFragment);
//            log.trace("Partial download retained: id={} range={} bytes={} of {}",
//                    downloadId, rangeStart, bytesTransferred, fileSize);
//        }
//    }
//
//    private DownloadStatus createNewDownloadStatus(
//            String downloadId, String userId, String fileName,
//            String filePath, long fileSize, String remoteAddr, String userAgent) {
//        log.debug("New download detected: id={} user={} file={}",
//                downloadId, userId, fileName);
//
//        DownloadStatus status = new DownloadStatus();
//        status.setDownloadId(downloadId);
//        status.setUserId(userId);
//        status.setFileName(fileName);
//        status.setFilePath(filePath);
//        status.setFileSize(fileSize);
//        status.setRemoteAddr(remoteAddr);
//        status.setUserAgent(userAgent);
//        status.setStarted(true);
//        status.setCompleted(false);
//        status.setLastSeen(Instant.now());
//
//        // Add to user history
//        userHistory.computeIfAbsent(userId, k -> new ArrayList<>()).add(status);
//
//        return status;
//    }
//
//    private void updateDownloadStatus(
//            DownloadStatus status, long bytesSent, long bytesTransferred,
//            double duration, String eventType, String statusCode, String timestamp) {
//
//        status.setBytesSent(bytesSent);
//        status.setBytesTransferred(bytesTransferred);
//        status.setDuration(duration);
//        status.setType(DownloadStatus.DownloadType.determineType(
//                eventType, status.getFileSize(), bytesTransferred, duration));
//        String isoTimestamp = parseLogTimestamp(timestamp).toString();
//        status.setLastSeen(Instant.parse(isoTimestamp));
//
//        // Update completion status if this is a complete event
//        if ("COMPLETE".equals(eventType) || "200".equals(statusCode)) {
//            status.setCompleted(true);
//        }
//    }
//
//    private boolean isDownloadComplete(String status, long fileSize, long lastByteServed) {
//        return "200".equals(status) ||
//                "COMPLETE".equals(status) ||
//                (fileSize > 0 && lastByteServed >= fileSize - 1);
//    }
//
//    private void handleCompleteDownload(DownloadStatus downloadStatus) {
//        downloadStatus.setCompleted(true);
//        log.info("Download completed: id={} file={} transferred={}/{} ({}%)",
//                downloadStatus.getDownloadId(),
//                downloadStatus.getFileName(),
//                downloadStatus.getBytesTransferred(),
//                downloadStatus.getFileSize(),
//                downloadStatus.getCompletionPercentage());
//
//        saveToDb(downloadStatus);
//        cache.remove(downloadStatus.getDownloadId());
//    }
//
//    private void cleanupInactiveDownloads() {
//        Instant cutoff = Instant.now().minusMillis(INACTIVITY_THRESHOLD_MS);
//        cache.entrySet().removeIf(entry -> {
//            DownloadStatus status = entry.getValue();
//            try {
//                Instant lastSeen = parseLogTimestamp(status.getLastSeen().toString());
//                boolean inactive = lastSeen.isBefore(cutoff);
//                if (inactive) {
//                    log.debug("Removing inactive download: id={} lastSeen={}",
//                            status.getDownloadId(), status.getLastSeen());
//                }
//                return inactive;
//            } catch (DateTimeParseException e) {
//                log.warn("Invalid timestamp format for download {}: {}",
//                        status.getDownloadId(), status.getLastSeen());
//                return true; // Remove entries with invalid timestamps
//            }
//        });
//    }
//
//    private Instant parseLogTimestamp(String timestamp) {
//        if (timestamp == null || timestamp.isEmpty()) {
//            return Instant.now();
//        }
//        try {
//            // Try ISO-8601 format first
//            return Instant.parse(timestamp);
//        } catch (DateTimeParseException e) {
//            // Fall back to log format
//            LocalDateTime localDateTime = LocalDateTime.parse(timestamp, LOG_DATE_FORMATTER);
//            return localDateTime.atZone(ZoneId.systemDefault()).toInstant();
//        }
//    }
//
//    public List<DownloadStatus> getAllRecentDownloads() {
//        Instant cutoff = Instant.now().minusMillis(INACTIVITY_THRESHOLD_MS);
//        return new ArrayList<>(cache.values()).stream()
//                .filter(status -> Instant.parse(status.getLastSeen()).isAfter(cutoff))
//                .collect(Collectors.toList());
//    }
//
//    public List<DownloadStatus> getUserDownloads(String userId) {
//        return userHistory.getOrDefault(userId, Collections.emptyList());
//    }
//
//    private void writeRetainedEntriesToLog(List<String> retainedEntries) throws IOException {
//        if (!retainedEntries.isEmpty()) {
//            Files.write(Path.of(downloadLogPath), retainedEntries);
//        }
//    }
//
//    private void saveToDb(DownloadStatus status) {
//        try {
//            var userEntity = userService.getUserEntityByEmail(status.getUserId());
//            Date fiveHoursAgo = new Date(System.currentTimeMillis() - FIVE_HOURS_IN_MS);
//
//            if (repo.existsRecentMatch(status.getUserId(), status.getType().toString(),
//                    status.getFileName(), fiveHoursAgo)) {
//                log.debug("Skipping DB save - recent record exists for user={} file={} type={}",
//                        status.getUserId(), status.getFileName(), status.getType());
//                return;
//            }
//
//            UserCinemaDataEntity entity = new UserCinemaDataEntity();
//            entity.setUser(userEntity);
//            entity.setEvent(status.getType().toString());
//            entity.setValue(status.getFileName());
//            repo.save(entity);
//
//            log.info("✅ Download persisted to DB: user={} file={} type={}",
//                    status.getUserId(), status.getFileName(), status.getType());
//        } catch (Exception e) {
//            log.error("❌ Failed to persist download: user={} file={} error={}",
//                    status.getUserId(), status.getFileName(), e.getMessage(), e);
//        }
//    }
//
//    private String decode(String value) {
//        return value == null ? "" : URLDecoder.decode(value, StandardCharsets.UTF_8);
//    }
//
//    private String now() {
//        return Instant.now().toString();
//    }
//
//    private long parseRangeStart(String range) {
//        if (range == null || !range.startsWith(BYTES_PREFIX)) {
//            return 0;
//        }
//
//        try {
//            String[] parts = range.substring(BYTES_PREFIX.length()).split("-");
//            return Long.parseLong(parts[0].trim());
//        } catch (Exception e) {
//            log.warn("Invalid rangeStart: '{}', error: {}", range, e.getMessage());
//            return 0;
//        }
//    }
//
//    private long getFileSize(String filePath) {
//        try {
//            return Files.size(Path.of(filePath));
//        } catch (IOException e) {
//            log.debug("Failed to get file size for '{}': {}", filePath, e.getMessage());
//            return 0;
//        }
//    }
//
//    private long parseLongSafe(String value) {
//        try {
//            return Long.parseLong(value);
//        } catch (NumberFormatException e) {
//            return 0;
//        }
//    }
//
//    private String toString(Object obj) {
//        return obj != null ? obj.toString() : "";
//    }
//
//    private double parseDoubleSafe(String value) {
//        try {
//            return Double.parseDouble(value);
//        } catch (NumberFormatException e) {
//            return 0.0;
//        }
//    }
//}