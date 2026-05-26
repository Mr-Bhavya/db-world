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
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Tracks user activity sessions for the cinema CDN.
 *
 * <p>Writes go through exactly one entry point: {@link #trackResolveActivity}. It creates
 * (or refreshes) the canonical row for {@code (user, file_path, activity_type)}, which is
 * then progressively updated by {@code LogShipperService} as nginx writes JSON access-log
 * lines for the matching {@code downloadId}.
 *
 * <p>The unique key {@code uk_user_file_activity (user_id, file_path, activity_type)}
 * guarantees one row per session. Multi-connection downloaders (aria2, IDM) all share
 * the same row because they all hit {@code /resolve} once and then issue many CDN
 * requests under the same {@code downloadId}; the shipper aggregates those into one
 * absolute-value UPDATE.
 */
@Log4j2
@Service
@RequiredArgsConstructor
@Transactional
public class UserCinemaActivityService {

    private final UserService                    userService;
    private final UserCinemaActivityRepository   userCinemaActivityRepository;
    private final ActivityEnricher               activityEnricher;

    /* =====================================================================
       WRITE PATH — one entry point
       ===================================================================== */

    /**
     * Establishes (or refreshes) the session row for a CDN {@code /resolve} call.
     * Records the {@code downloadId} / {@code cdnUrl} so nginx access-log lines can be
     * correlated by the shipper. Progress and completion are written later by the shipper.
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
                .bytesIncrement(0L)
                .status(CompletionStatus.STARTED)
                .sessionId(downloadId != null ? downloadId
                        : sessionId(userEmail, filePath, type))
                .build());
    }

    /** Upsert wrapper — enrichment, UA classification, hand-off to the native query. */
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
                1,
                status.name(),
                percent,
                clientType.name(),
                s.downloadId(),
                s.cdnUrl(),
                Instant.now()
        );
    }

    /* =====================================================================
       HELPERS
       ===================================================================== */

    private BigDecimal computeCompletionPercent(long bytesIncrement, Long fileSize) {
        if (fileSize == null || fileSize <= 0 || bytesIncrement <= 0) return null;
        return BigDecimal.valueOf(bytesIncrement * 100.0 / fileSize)
                .setScale(2, RoundingMode.HALF_UP)
                .min(BigDecimal.valueOf(100));
    }

    private String sessionId(String userEmail, String filePath, ActivityType type) {
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
       READ-ONLY API — pass-throughs to the repository.
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
}
