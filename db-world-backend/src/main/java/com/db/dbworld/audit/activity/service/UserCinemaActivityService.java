package com.db.dbworld.audit.activity.service;

import com.db.dbworld.audit.activity.enrich.ActivityEnricher;
import com.db.dbworld.audit.activity.entity.UserCinemaActivityEntity;
import com.db.dbworld.audit.activity.entity.UserCinemaActivityEntity.ActivityType;
import com.db.dbworld.audit.activity.entity.UserCinemaActivityEntity.ClientType;
import com.db.dbworld.audit.activity.entity.UserCinemaActivityEntity.CompletionStatus;
import com.db.dbworld.audit.activity.repository.UserCinemaActivityRepository;
import com.db.dbworld.audit.activity.util.UserAgentClassifier;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Tracks user download/stream/search activity with production-grade de-duplication.
 *
 * <p>The {@code uk_user_file_activity} unique key on (user_id, file_path, activity_type)
 * makes one row per (user, file, type). Multi-connection downloaders (aria2, IDM) hit
 * the same row via {@code INSERT … ON DUPLICATE KEY UPDATE}, which:
 * <ul>
 *   <li>increments {@code update_count},</li>
 *   <li>accumulates {@code bytes_transferred} across parallel range requests,</li>
 *   <li>tracks peak {@code connection_count} via {@code GREATEST(...)},</li>
 *   <li>refreshes {@code completion_status} / {@code completion_percent} / {@code last_updated}.</li>
 * </ul>
 *
 * <p>A small in-memory window dedups identical requests within 1 second to reduce DB
 * write pressure when range clients fire many tiny chunks; the DB still enforces
 * correctness if the window fails to suppress.
 */
@Log4j2
@Service
@RequiredArgsConstructor
@Transactional
public class UserCinemaActivityService {

    private final UserService                    userService;
    private final UserCinemaActivityRepository   userCinemaActivityRepository;
    private final ActivityEnricher               activityEnricher;

    /** Soft request-coalescing window. The DB enforces correctness regardless. */
    private static final Duration WRITE_COALESCE_WINDOW = Duration.ofSeconds(1);

    private static final Pattern RANGE_PATTERN = Pattern.compile("bytes=(\\d+)-(\\d*)");

    /** Key: userEmail|filePath|type|rangeHeader → ts of last write. Bounded eviction below. */
    private final Map<String, Instant> writeCoalesceMap = new ConcurrentHashMap<>();

    /* =====================================================================
       PUBLIC TRACKING ENTRY POINTS
       ===================================================================== */

    /**
     * One-time tracking for a CDN /resolve call. Establishes the session row with the
     * download_id / cdn_url so nginx CDN logs can be correlated by matching downloadId.
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void trackResolveActivity(String userEmail, String filePath, String fileName,
                                     Long fileSize, String remoteAddr, String userAgent,
                                     boolean isStream, String downloadId, String cdnUrl) {
        if (userEmail == null || filePath == null) return;
        UserEntity user = userService.getUserEntityByEmail(userEmail);
        if (user == null) { log.warn("trackResolveActivity: user not found: {}", userEmail); return; }

        ActivityType type = isStream ? ActivityType.STREAM : ActivityType.DOWNLOAD;
        upsert(UpsertSpec.builder()
                .user(user)
                .type(type)
                .filePath(filePath)
                .fileName(fileName)
                .fileSize(fileSize)
                .userAgent(userAgent)
                .remoteAddr(remoteAddr)
                .downloadId(downloadId)
                .cdnUrl(cdnUrl)
                .bytesIncrement(0L)                       // resolve = no bytes yet
                .status(CompletionStatus.STARTED)
                .sessionId(downloadId != null ? downloadId
                        : sessionId(userEmail, filePath, type))
                .build());
    }

    /** Range or full-file download request — accumulates bytes on the canonical row. */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void trackDownloadActivity(String userEmail, String filePath, String fileName,
                                      Long fileSize, String rangeHeader, String remoteAddr,
                                      String userAgent) {
        trackTransfer(userEmail, filePath, fileName, fileSize, rangeHeader, remoteAddr, userAgent,
                ActivityType.DOWNLOAD);
    }

    /** Range or full-file stream request. */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void trackStreamActivity(String userEmail, String filePath, String fileName,
                                    Long fileSize, String rangeHeader, String remoteAddr,
                                    String userAgent) {
        trackTransfer(userEmail, filePath, fileName, fileSize, rangeHeader, remoteAddr, userAgent,
                ActivityType.STREAM);
    }

    /** Marks the canonical session row as COMPLETED and bumps lifetime counters. */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markDownloadComplete(String userEmail, String filePath, Long totalBytes) {
        markComplete(userEmail, filePath, totalBytes, ActivityType.DOWNLOAD);
    }

    /** Same as {@link #markDownloadComplete} for streams. */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markStreamComplete(String userEmail, String filePath, Long totalBytes) {
        markComplete(userEmail, filePath, totalBytes, ActivityType.STREAM);
    }

    /* =====================================================================
       CORE — single upsert path used by every tracking entry point
       ===================================================================== */

    private void trackTransfer(String userEmail, String filePath, String fileName,
                               Long fileSize, String rangeHeader, String remoteAddr,
                               String userAgent, ActivityType type) {
        if (userEmail == null || filePath == null) return;

        // Coalesce identical (user|file|range) writes within 1s — the DB still enforces
        // correctness if the window fails to suppress (concurrent JVMs / restart).
        String coalesceKey = userEmail + "|" + filePath + "|" + type + "|"
                + (rangeHeader != null ? rangeHeader : "full");
        if (isCoalesced(coalesceKey)) return;
        writeCoalesceMap.put(coalesceKey, Instant.now());
        evictOldCoalesceEntries();

        UserEntity user = userService.getUserEntityByEmail(userEmail);
        if (user == null) { log.warn("trackTransfer: user not found: {}", userEmail); return; }

        long bytesIncrement = computeBytesIncrement(rangeHeader, fileSize);

        upsert(UpsertSpec.builder()
                .user(user)
                .type(type)
                .filePath(filePath)
                .fileName(fileName)
                .fileSize(fileSize)
                .userAgent(userAgent)
                .remoteAddr(remoteAddr)
                .bytesIncrement(bytesIncrement)
                .status(CompletionStatus.IN_PROGRESS)
                .sessionId(sessionId(userEmail, filePath, type))
                .build());
    }

    private void markComplete(String userEmail, String filePath, Long totalBytes, ActivityType type) {
        if (userEmail == null || filePath == null) return;
        UserEntity user = userService.getUserEntityByEmail(userEmail);
        if (user == null) return;
        Long avgBps = computeAvgSpeedBps(user.getUserId(), filePath, type, totalBytes);
        int updated = userCinemaActivityRepository.markCompleted(
                user.getUserId(), filePath, type.name(), avgBps, Instant.now());
        if (updated == 0) {
            log.warn("markComplete: no row matched for user={}, file={}, type={}",
                    userEmail, filePath, type);
        }
    }

    /** Upsert wrapper — fills enrichment, classifies UA, hands off to the native query. */
    private void upsert(UpsertSpec s) {
        ActivityEnricher.Enrichment e = activityEnricher.resolve(s.filePath());
        ClientType clientType = UserAgentClassifier.classify(s.userAgent());
        BigDecimal percent = computeCompletionPercent(s.bytesIncrement(), s.fileSize());
        CompletionStatus status = percent != null && percent.compareTo(BigDecimal.valueOf(100)) >= 0
                ? CompletionStatus.COMPLETED
                : s.status();

        userCinemaActivityRepository.upsertSession(
                s.user().getUserId(),
                s.type().name(),
                s.fileName() != null ? s.fileName() : s.filePath(),
                s.sessionId(),
                s.filePath(),
                s.fileSize(),
                s.userAgent(),
                s.remoteAddr(),
                s.bytesIncrement(),
                e.recordId(),
                e.mediaFileId(),
                1,                                       // connection_count seed; GREATEST keeps the max
                status.name(),
                percent,
                clientType.name(),
                null,                                    // httpProtocol — could be wired from request later
                null,                                    // referer — same
                null,                                    // countryCode — geo lookup is a follow-up
                s.downloadId(),
                s.cdnUrl(),
                Instant.now()
        );
    }

    /* =====================================================================
       HELPERS
       ===================================================================== */

    /** Bytes implied by a Range header — falls back to full fileSize when no range. */
    private long computeBytesIncrement(String rangeHeader, Long fileSize) {
        if (rangeHeader == null || rangeHeader.isBlank()) {
            return fileSize != null ? fileSize : 0L;
        }
        Matcher m = RANGE_PATTERN.matcher(rangeHeader.trim());
        if (!m.matches()) return 0L;
        try {
            long start = Long.parseLong(m.group(1));
            String endStr = m.group(2);
            long end = (endStr != null && !endStr.isEmpty()) ? Long.parseLong(endStr)
                                                              : (fileSize != null ? fileSize - 1 : -1);
            return end >= start ? (end - start + 1) : 0L;
        } catch (NumberFormatException ex) {
            return 0L;
        }
    }

    private BigDecimal computeCompletionPercent(long bytesIncrement, Long fileSize) {
        if (fileSize == null || fileSize <= 0 || bytesIncrement <= 0) return null;
        return BigDecimal.valueOf(bytesIncrement * 100.0 / fileSize)
                .setScale(2, RoundingMode.HALF_UP)
                .min(BigDecimal.valueOf(100));
    }

    private Long computeAvgSpeedBps(Long userId, String filePath, ActivityType type, Long totalBytes) {
        if (totalBytes == null || totalBytes <= 0) return null;
        // best-effort: query elapsed since firstSeenAt by the existing repo
        var sessions = userCinemaActivityRepository.findMostRecentActiveSession(
                userId, filePath, type, Instant.EPOCH, PageRequest.of(0, 1));
        if (sessions.isEmpty()) return null;
        Instant start = sessions.get(0).getFirstSeenAt() != null
                ? sessions.get(0).getFirstSeenAt() : sessions.get(0).getCreatedTime();
        if (start == null) return null;
        long elapsedSec = Math.max(1, Duration.between(start, Instant.now()).getSeconds());
        return totalBytes / elapsedSec;
    }

    private boolean isCoalesced(String key) {
        Instant last = writeCoalesceMap.get(key);
        return last != null && Duration.between(last, Instant.now()).compareTo(WRITE_COALESCE_WINDOW) < 0;
    }

    private void evictOldCoalesceEntries() {
        // Keep the map bounded; called on every write but cheap when small.
        if (writeCoalesceMap.size() <= 1024) return;
        Instant cutoff = Instant.now().minus(WRITE_COALESCE_WINDOW.multipliedBy(10));
        writeCoalesceMap.entrySet().removeIf(en -> en.getValue().isBefore(cutoff));
    }

    private String sessionId(String userEmail, String filePath, ActivityType type) {
        // Stable per (user, file, type) — collisions are fine because the unique key
        // already enforces one row, and the session_id is purely informational here.
        return userEmail + "_" + Integer.toHexString(filePath.hashCode()) + "_" + type;
    }

    /** Builder-only payload struct for {@link #upsert}. */
    private record UpsertSpec(
            UserEntity user, ActivityType type, String filePath, String fileName,
            Long fileSize, String userAgent, String remoteAddr,
            Long bytesIncrement, CompletionStatus status, String sessionId,
            String downloadId, String cdnUrl) {
        static Builder builder() { return new Builder(); }
        static class Builder {
            UserEntity user; ActivityType type; String filePath; String fileName;
            Long fileSize; String userAgent; String remoteAddr;
            Long bytesIncrement; CompletionStatus status; String sessionId;
            String downloadId; String cdnUrl;
            Builder user(UserEntity v)             { this.user = v; return this; }
            Builder type(ActivityType v)            { this.type = v; return this; }
            Builder filePath(String v)              { this.filePath = v; return this; }
            Builder fileName(String v)              { this.fileName = v; return this; }
            Builder fileSize(Long v)                { this.fileSize = v; return this; }
            Builder userAgent(String v)             { this.userAgent = v; return this; }
            Builder remoteAddr(String v)            { this.remoteAddr = v; return this; }
            Builder bytesIncrement(Long v)          { this.bytesIncrement = v; return this; }
            Builder status(CompletionStatus v)      { this.status = v; return this; }
            Builder sessionId(String v)             { this.sessionId = v; return this; }
            Builder downloadId(String v)            { this.downloadId = v; return this; }
            Builder cdnUrl(String v)                { this.cdnUrl = v; return this; }
            UpsertSpec build() {
                return new UpsertSpec(user, type, filePath, fileName, fileSize,
                        userAgent, remoteAddr, bytesIncrement, status, sessionId,
                        downloadId, cdnUrl);
            }
        }
    }

    /* =====================================================================
       READ-ONLY API (unchanged) — pass-throughs to the repository.
       ===================================================================== */

    public List<UserCinemaActivityEntity> getRecentActivities(UserEntity user, Instant cutoffTime, int limit) {
        return userCinemaActivityRepository.findByUserAndLastUpdatedAfterOrderByLastUpdatedDesc(
                user, cutoffTime, PageRequest.of(0, limit));
    }

    public List<UserCinemaActivityEntity> getRecentActivitiesByType(UserEntity user,
                                                                    ActivityType activityType,
                                                                    Instant cutoffTime, int limit) {
        return userCinemaActivityRepository.findByUserAndActivityTypeAndLastUpdatedAfterOrderByLastUpdatedDesc(
                user, activityType, cutoffTime, PageRequest.of(0, limit));
    }

    public Map<ActivityType, Long> getActivityStats(UserEntity user, Instant cutoffTime) {
        Map<ActivityType, Long> stats = new HashMap<>();
        for (ActivityType t : ActivityType.values()) {
            stats.put(t, userCinemaActivityRepository.countByUserAndActivityTypeAndLastUpdatedAfter(user, t, cutoffTime));
        }
        return stats;
    }

    public List<UserCinemaActivityEntity> getAllRecentActivities(Instant cutoffTime, int limit) {
        return userCinemaActivityRepository.findByLastUpdatedAfterOrderByLastUpdatedDesc(
                cutoffTime, PageRequest.of(0, limit));
    }

    public List<UserCinemaActivityEntity> getAllRecentActivitiesByType(
            ActivityType activityType, Instant cutoffTime, int limit) {
        return userCinemaActivityRepository.findByActivityTypeAndLastUpdatedAfterOrderByLastUpdatedDesc(
                activityType, cutoffTime, PageRequest.of(0, limit));
    }

    public Map<ActivityType, Long> getActivityStatsAll(Instant cutoffTime) {
        Map<ActivityType, Long> stats = new HashMap<>();
        for (ActivityType t : ActivityType.values()) {
            stats.put(t, userCinemaActivityRepository.countByActivityTypeAndLastUpdatedAfter(t, cutoffTime));
        }
        return stats;
    }

    public List<Map<String, Object>> getActiveUsersWithStats(Instant cutoffTime) {
        return userCinemaActivityRepository.findActiveUsersWithStats(cutoffTime);
    }

    public Map<String, Object> getDashboardStats(Instant cutoffTime) {
        return userCinemaActivityRepository.getDashboardStats(cutoffTime);
    }

    public Long getTotalActivitiesCount(Instant cutoffTime) {
        return userCinemaActivityRepository.countByLastUpdatedAfter(cutoffTime);
    }

    public Long getActiveUsersCount(Instant cutoffTime) {
        return userCinemaActivityRepository.countDistinctUsersByLastUpdatedAfter(cutoffTime);
    }

    public List<Map<String, Object>> getTopDownloadedFiles(Instant cutoffTime, int limit) {
        return userCinemaActivityRepository.getTopDownloadedFiles(cutoffTime, limit);
    }

    public List<Map<String, Object>> getPopularSearchKeywords(Instant cutoffTime, int limit) {
        return userCinemaActivityRepository.getPopularSearchKeywords(cutoffTime, limit);
    }

    public List<Map<String, Object>> getFileTypeStats(Instant cutoffTime) {
        return userCinemaActivityRepository.getFileTypeStats(cutoffTime);
    }

    public List<Map<String, Object>> getPeakUsageHours(Instant cutoffTime) {
        return userCinemaActivityRepository.getPeakUsageHours(cutoffTime);
    }

    /** Monitoring hook. The DB-side upsert means the in-memory map is purely a write-coalescer. */
    public Map<String, Object> getSessionStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("writeCoalesceMapSize", writeCoalesceMap.size());
        return stats;
    }

    public void clearCaches() {
        writeCoalesceMap.clear();
        log.info("Activity write-coalesce map cleared");
    }
}
