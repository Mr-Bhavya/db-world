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

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Log4j2
@Service
@Getter
public class NginxDownloadLogTrackerService {

    private static final String JSON_START = "##JSON_START##";
    private static final String JSON_END = "##JSON_END##";
    private static final String BYTES_PREFIX = "bytes=";
    private static final int FIVE_HOURS_IN_MS = 5 * 60 * 60 * 1000;

    private final UserCinemaDataRepository repo;
    private final UserService userService;
    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, DownloadStatus> cache = new ConcurrentHashMap<>();

    @Value("${dbworld.paths.downloadLogPath}")
    private String downloadLogPath;

    public NginxDownloadLogTrackerService(
            UserCinemaDataRepository repo,
            UserService userService
    ) {
        this.repo = repo;
        this.userService = userService;
    }

    @Scheduled(fixedDelay = 10000)
    public void scanDownloadLogs() {
        try {
            String content = Files.readString(Path.of(downloadLogPath));
            List<String> retainedEntries = processLogContent(content);
            writeRetainedEntriesToLog(retainedEntries);
        } catch (IOException e) {
            log.error("Error reading/parsing log file: {}", e.getMessage(), e);
        }
    }

    private List<String> processLogContent(String content) {
        List<String> retainedEntries = new ArrayList<>();
        AtomicInteger processedCount = new AtomicInteger();
        AtomicInteger skippedCount = new AtomicInteger();

        int startIdx = 0;
        while ((startIdx = content.indexOf(JSON_START, startIdx)) != -1) {
            int endIdx = content.indexOf(JSON_END, startIdx);
            if (endIdx == -1) {
                log.warn("Incomplete log entry found. Skipping rest.");
                break;
            }

            String jsonFragment = content.substring(startIdx + JSON_START.length(), endIdx);
            startIdx = endIdx + JSON_END.length();

            try {
                processLogEntry(jsonFragment, retainedEntries);
                processedCount.incrementAndGet();
            } catch (Exception ex) {
                skippedCount.incrementAndGet();
                log.error("Failed to parse JSON log: {}", ex.getMessage(), ex);
            }
        }

        log.debug("Processed={} Skipped={} Remaining={}",
                processedCount.get(), skippedCount.get(), retainedEntries.size());
        return retainedEntries;
    }

    private void processLogEntry(String jsonFragment, List<String> retainedEntries) throws IOException {
        Map<String, String> logData = mapper.readValue(jsonFragment, Map.class);

        String downloadId = decode(logData.get("downloadId"));
        String userId = decode(logData.get("userId"));
        String originalFile = decode(logData.get("originalFile"));
        String range = decode(logData.get("rangeStart"));
        String bytesSentStr = logData.getOrDefault("bytesSent", "0");
        String type = decode(logData.get("type"));
        String status = decode(logData.get("status"));

        long rangeStartVal = parseRangeStart(range);
        long bytesSentVal = parseLongSafe(bytesSentStr);
        long fileSize = getFileSize(originalFile);
        long lastByteServed = rangeStartVal + bytesSentVal - 1;

        DownloadStatus downloadStatus = cache.computeIfAbsent(downloadId, id ->
                createNewDownloadStatus(downloadId, userId, originalFile, type));

        downloadStatus.setLastSeen(now());
        downloadStatus.setStarted(true);

        if (isDownloadComplete(status, fileSize, lastByteServed)) {
            handleCompleteDownload(downloadStatus);
        } else {
            retainedEntries.add(JSON_START + jsonFragment + JSON_END);
            log.trace("Partial download retained: id={} range={} bytesSent={} of {}",
                    downloadId, range, bytesSentVal, fileSize);
        }
    }

    private DownloadStatus createNewDownloadStatus(String downloadId, String userId,
                                                   String originalFile, String type) {
        log.debug("New download detected: id={} user={} file={} type={}",
                downloadId, userId, originalFile, type);
        return new DownloadStatus(downloadId, userId, originalFile, DownloadStatus.DownloadType.valueOf(type.toUpperCase()), false, false, now());
    }

    private boolean isDownloadComplete(String status, long fileSize, long lastByteServed) {
        return "200".equals(status) || (fileSize != 0 && lastByteServed >= fileSize - 1);
    }

    private void handleCompleteDownload(DownloadStatus downloadStatus) {
        downloadStatus.setCompleted(true);
        log.debug("Full download detected: id={} file={}",
                downloadStatus.getDownloadId(), downloadStatus.getFileName());
        saveToDb(downloadStatus);
        cache.remove(downloadStatus.getDownloadId());
    }

    private void writeRetainedEntriesToLog(List<String> retainedEntries) throws IOException {
        if (!retainedEntries.isEmpty()) {
            Files.write(Path.of(downloadLogPath), retainedEntries);
        }
    }

    private void saveToDb(DownloadStatus status) {
        try {
            var userEntity = userService.getUserEntityByEmail(status.getUserId());
            Date fiveHoursAgo = new Date(System.currentTimeMillis() - FIVE_HOURS_IN_MS);

            if (repo.existsRecentMatch(status.getUserId(), status.getType().toString(),
                    status.getFileName(), fiveHoursAgo)) {
                log.debug("Skipping DB save - recent record exists for user={} file={} type={}",
                        status.getUserId(), status.getFileName(), status.getType());
                return;
            }

            UserCinemaDataEntity entity = new UserCinemaDataEntity();
            entity.setUser(userEntity);
            entity.setEvent(status.getType().toString());
            entity.setValue(status.getFileName());
            repo.save(entity);

            log.info("✅ Download persisted to DB: user={} file={} type={}",
                    status.getUserId(), status.getFileName(), status.getType());
        } catch (Exception e) {
            log.error("❌ Failed to persist download: user={} file={} error={}",
                    status.getUserId(), status.getFileName(), e.getMessage(), e);
        }
    }

    private String decode(String value) {
        return value == null ? "" : URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private String now() {
        return Instant.now().toString();
    }

    private long parseRangeStart(String range) {
        if (range == null || !range.startsWith(BYTES_PREFIX)) {
            return 0;
        }

        try {
            String[] parts = range.substring(BYTES_PREFIX.length()).split("-");
            return Long.parseLong(parts[0].trim());
        } catch (Exception e) {
            log.warn("Invalid rangeStart: '{}', error: {}", range, e.getMessage());
            return 0;
        }
    }

    private long getFileSize(String filePath) {
        try {
            return Files.size(Path.of(filePath));
        } catch (IOException e) {
            log.debug("Failed to get file size for '{}': {}", filePath, e.getMessage());
            return 0;
        }
    }

    private long parseLongSafe(String value) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}