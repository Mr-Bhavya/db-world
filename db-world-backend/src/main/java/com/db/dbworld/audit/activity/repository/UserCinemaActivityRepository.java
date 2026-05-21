package com.db.dbworld.audit.activity.repository;

import com.db.dbworld.audit.activity.entity.UserCinemaActivityEntity;
import com.db.dbworld.core.user.entity.UserEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public interface UserCinemaActivityRepository extends JpaRepository<UserCinemaActivityEntity, Long> {

    @Query("SELECT u FROM UserCinemaActivityEntity u WHERE u.user = :user AND u.activityType = :activityType " +
            "AND u.sessionId LIKE :sessionIdPattern AND u.lastUpdated > :cutoffTime " +
            "ORDER BY u.lastUpdated DESC")
    Optional<UserCinemaActivityEntity> findByUserAndActivityTypeAndSessionIdLikeAndLastUpdatedAfter(
            @Param("user") UserEntity user,
            @Param("activityType") UserCinemaActivityEntity.ActivityType activityType,
            @Param("sessionIdPattern") String sessionIdPattern,
            @Param("cutoffTime") Instant cutoffTime);

    @Query("SELECT u FROM UserCinemaActivityEntity u WHERE u.user = :user AND u.activityType = :activityType " +
            "AND u.sessionId LIKE :sessionIdPattern ORDER BY u.lastUpdated DESC")
    Optional<UserCinemaActivityEntity> findTopByUserAndActivityTypeAndSessionIdLikeOrderByLastUpdatedDesc(
            @Param("user") UserEntity user,
            @Param("activityType") UserCinemaActivityEntity.ActivityType activityType,
            @Param("sessionIdPattern") String sessionIdPattern);

    // User-specific queries
    List<UserCinemaActivityEntity> findByUserAndLastUpdatedAfterOrderByLastUpdatedDesc(
            UserEntity user,
            Instant cutoffTime,
            Pageable pageable);

    List<UserCinemaActivityEntity> findByUserAndActivityTypeAndLastUpdatedAfterOrderByLastUpdatedDesc(
            UserEntity user,
            UserCinemaActivityEntity.ActivityType activityType,
            Instant cutoffTime,
            Pageable pageable);

    Long countByUserAndActivityTypeAndLastUpdatedAfter(
            UserEntity user,
            UserCinemaActivityEntity.ActivityType activityType,
            Instant cutoffTime);

    // Admin queries - All users
    List<UserCinemaActivityEntity> findByLastUpdatedAfterOrderByLastUpdatedDesc(
            Instant cutoffTime,
            Pageable pageable);

    List<UserCinemaActivityEntity> findByActivityTypeAndLastUpdatedAfterOrderByLastUpdatedDesc(
            UserCinemaActivityEntity.ActivityType activityType,
            Instant cutoffTime,
            Pageable pageable);

    Long countByActivityTypeAndLastUpdatedAfter(
            UserCinemaActivityEntity.ActivityType activityType,
            Instant cutoffTime);

    Long countByLastUpdatedAfter(Instant cutoffTime);

    // Active users with statistics - MySQL compatible
    @Query(value = "SELECT " +
            "u.user_id as userId, " +
            "usr.email as userEmail, " +
            "COUNT(u.id) as totalActivities, " +
            "MAX(u.last_updated) as lastActivity, " +
            "SUM(CASE WHEN u.activity_type = 'DOWNLOAD' THEN 1 ELSE 0 END) as downloadCount, " +
            "SUM(CASE WHEN u.activity_type = 'STREAM' THEN 1 ELSE 0 END) as streamCount, " +
            "SUM(CASE WHEN u.activity_type = 'SEARCH' THEN 1 ELSE 0 END) as searchCount " +
            "FROM user_cinema_activity u " +
            "INNER JOIN users usr ON u.user_id = usr.id " +
            "WHERE u.last_updated > :cutoffTime " +
            "GROUP BY u.user_id, usr.email " +
            "ORDER BY lastActivity DESC",
            nativeQuery = true)
    List<Map<String, Object>> findActiveUsersWithStats(@Param("cutoffTime") Instant cutoffTime);

    // Count distinct active users
    @Query("SELECT COUNT(DISTINCT u.user) FROM UserCinemaActivityEntity u WHERE u.lastUpdated > :cutoffTime")
    Long countDistinctUsersByLastUpdatedAfter(@Param("cutoffTime") Instant cutoffTime);

    // Dashboard statistics - MySQL compatible
    @Query(value = "SELECT " +
            "COUNT(u.id) as totalActivities, " +
            "COUNT(DISTINCT u.user_id) as uniqueUsers, " +
            "SUM(CASE WHEN u.activity_type = 'DOWNLOAD' THEN 1 ELSE 0 END) as totalDownloads, " +
            "SUM(CASE WHEN u.activity_type = 'STREAM' THEN 1 ELSE 0 END) as totalStreams, " +
            "SUM(CASE WHEN u.activity_type = 'SEARCH' THEN 1 ELSE 0 END) as totalSearches, " +
            "COALESCE(AVG(u.file_size), 0) as avgFileSize, " +
            "MAX(u.last_updated) as latestActivity " +
            "FROM user_cinema_activity u " +
            "WHERE u.last_updated > :cutoffTime",
            nativeQuery = true)
    Map<String, Object> getDashboardStats(@Param("cutoffTime") Instant cutoffTime);

    // Activity statistics by hour (for charts) - MySQL compatible
    @Query(value = "SELECT " +
            "HOUR(u.last_updated) as hour, " +
            "COUNT(u.id) as activityCount, " +
            "SUM(CASE WHEN u.activity_type = 'DOWNLOAD' THEN 1 ELSE 0 END) as downloads, " +
            "SUM(CASE WHEN u.activity_type = 'STREAM' THEN 1 ELSE 0 END) as streams " +
            "FROM user_cinema_activity u " +
            "WHERE u.last_updated > :cutoffTime " +
            "GROUP BY HOUR(u.last_updated) " +
            "ORDER BY hour",
            nativeQuery = true)
    List<Map<String, Object>> getActivityStatsByHour(@Param("cutoffTime") Instant cutoffTime);

    // Top downloaded files - MySQL compatible
    @Query(value = "SELECT " +
            "u.file_path as filePath, " +
            "u.activity_value as fileName, " +
            "COUNT(u.id) as downloadCount, " +
            "COALESCE(AVG(u.file_size), 0) as avgFileSize " +
            "FROM user_cinema_activity u " +
            "WHERE u.activity_type = 'DOWNLOAD' AND u.last_updated > :cutoffTime " +
            "GROUP BY u.file_path, u.activity_value " +
            "ORDER BY downloadCount DESC " +
            "LIMIT :limit",
            nativeQuery = true)
    List<Map<String, Object>> getTopDownloadedFiles(@Param("cutoffTime") Instant cutoffTime, @Param("limit") int limit);

    // User activity timeline - MySQL compatible
    @Query(value = "SELECT " +
            "DATE(u.last_updated) as date, " +
            "COUNT(u.id) as activityCount, " +
            "COUNT(DISTINCT u.user_id) as uniqueUsers " +
            "FROM user_cinema_activity u " +
            "WHERE u.last_updated > :cutoffTime " +
            "GROUP BY DATE(u.last_updated) " +
            "ORDER BY date DESC",
            nativeQuery = true)
    List<Map<String, Object>> getActivityTimeline(@Param("cutoffTime") Instant cutoffTime);

    // Search keyword analytics - MySQL compatible
    @Query(value = "SELECT " +
            "u.activity_value as searchKeyword, " +
            "COUNT(u.id) as searchCount, " +
            "MAX(u.last_updated) as lastSearched " +
            "FROM user_cinema_activity u " +
            "WHERE u.activity_type = 'SEARCH' AND u.last_updated > :cutoffTime " +
            "GROUP BY u.activity_value " +
            "ORDER BY searchCount DESC " +
            "LIMIT :limit",
            nativeQuery = true)
    List<Map<String, Object>> getPopularSearchKeywords(@Param("cutoffTime") Instant cutoffTime, @Param("limit") int limit);

    // User agent statistics - MySQL compatible
    @Query(value = "SELECT " +
            "u.user_agent as userAgent, " +
            "COUNT(u.id) as usageCount, " +
            "COUNT(DISTINCT u.user_id) as uniqueUsers " +
            "FROM user_cinema_activity u " +
            "WHERE u.last_updated > :cutoffTime AND u.user_agent IS NOT NULL " +
            "GROUP BY u.user_agent " +
            "ORDER BY usageCount DESC",
            nativeQuery = true)
    List<Map<String, Object>> getUserAgentStats(@Param("cutoffTime") Instant cutoffTime);

    // Geographic distribution (by IP) - MySQL compatible
    @Query(value = "SELECT " +
            "SUBSTRING_INDEX(u.remote_addr, '.', 1) as ipSegment, " +
            "COUNT(u.id) as activityCount, " +
            "COUNT(DISTINCT u.user_id) as uniqueUsers " +
            "FROM user_cinema_activity u " +
            "WHERE u.last_updated > :cutoffTime AND u.remote_addr IS NOT NULL " +
            "GROUP BY SUBSTRING_INDEX(u.remote_addr, '.', 1) " +
            "ORDER BY activityCount DESC",
            nativeQuery = true)
    List<Map<String, Object>> getGeographicDistribution(@Param("cutoffTime") Instant cutoffTime);

    // File type statistics - Additional useful query
    @Query(value = "SELECT " +
            "CASE " +
            "  WHEN u.file_path LIKE '%.mp4' OR u.file_path LIKE '%.mkv' OR u.file_path LIKE '%.avi' THEN 'Video' " +
            "  WHEN u.file_path LIKE '%.mp3' OR u.file_path LIKE '%.wav' OR u.file_path LIKE '%.flac' THEN 'Audio' " +
            "  WHEN u.file_path LIKE '%.pdf' OR u.file_path LIKE '%.doc' OR u.file_path LIKE '%.txt' THEN 'Document' " +
            "  ELSE 'Other' " +
            "END as fileType, " +
            "COUNT(u.id) as count, " +
            "AVG(u.file_size) as avgSize " +
            "FROM user_cinema_activity u " +
            "WHERE u.activity_type IN ('DOWNLOAD', 'STREAM') AND u.last_updated > :cutoffTime " +
            "GROUP BY fileType " +
            "ORDER BY count DESC",
            nativeQuery = true)
    List<Map<String, Object>> getFileTypeStats(@Param("cutoffTime") Instant cutoffTime);

    // Peak usage hours - Additional useful query
    @Query(value = "SELECT " +
            "HOUR(u.last_updated) as hour, " +
            "COUNT(u.id) as totalActivities, " +
            "COUNT(DISTINCT u.user_id) as uniqueUsers " +
            "FROM user_cinema_activity u " +
            "WHERE u.last_updated > :cutoffTime " +
            "GROUP BY HOUR(u.last_updated) " +
            "ORDER BY totalActivities DESC " +
            "LIMIT 5",
            nativeQuery = true)
    List<Map<String, Object>> getPeakUsageHours(@Param("cutoffTime") Instant cutoffTime);

    List<UserCinemaActivityEntity> findByUserAndActivityTypeAndFilePathAndLastUpdatedAfter(UserEntity user, UserCinemaActivityEntity.ActivityType activityType, String filePath, Instant cutoffTime, PageRequest of);

    List<UserCinemaActivityEntity> findByUserAndActivityTypeAndFilePathAndLastUpdatedAfterOrderByLastUpdatedDesc(UserEntity user, UserCinemaActivityEntity.ActivityType activityType, String filePath, Instant cutoffTime, PageRequest of);

    @Query("SELECT a FROM UserCinemaActivityEntity a " +
            "WHERE a.user.id = :userId " +
            "AND a.filePath = :filePath " +
            "AND a.activityType = 'DOWNLOAD' " +
            "AND a.lastUpdated > :cutoffTime " +
            "ORDER BY a.lastUpdated DESC")
    List<UserCinemaActivityEntity> findMostRecentActiveDownloadSession(
            @Param("userId") Long userId,
            @Param("filePath") String filePath,
            @Param("cutoffTime") Instant cutoffTime,
            Pageable pageable);

    @Query("SELECT a FROM UserCinemaActivityEntity a " +
            "WHERE a.user.userId = :userId " +
            "AND a.filePath = :filePath " +
            "AND a.activityType = :activityType " +
            "AND a.lastUpdated > :cutoffTime " +
            "ORDER BY a.lastUpdated DESC")
    List<UserCinemaActivityEntity> findMostRecentActiveSession(
            @Param("userId") Long userId,
            @Param("filePath") String filePath,
            @Param("activityType") UserCinemaActivityEntity.ActivityType activityType,
            @Param("cutoffTime") Instant cutoffTime,
            Pageable pageable);

    @Query("SELECT a FROM UserCinemaActivityEntity a " +
            "WHERE a.sessionId LIKE :sessionIdPattern " +
            "AND a.lastUpdated > :cutoffTime " +
            "ORDER BY a.lastUpdated DESC")
    List<UserCinemaActivityEntity> findBySessionIdLikeAndLastUpdatedAfter(
            @Param("sessionIdPattern") String sessionIdPattern,
            @Param("cutoffTime") Instant cutoffTime,
            Pageable pageable);

    /* =========================================================================
       PRODUCTION TRACKING — upsert + helpers (added 2026-05-21)
       =========================================================================
       The canonical key (user_id, file_path, activity_type) makes one row per
       (user, file, type). Multi-connection downloaders no longer create dupes —
       parallel range requests increment counters on the same row via the
       MySQL ON DUPLICATE KEY UPDATE branch below.
    */

    /**
     * Atomic upsert into user_cinema_activity. Insert if no row exists for
     * (user, file_path, activity_type); otherwise:
     *   - bump update_count
     *   - accumulate bytes_transferred (parallel range requests sum)
     *   - take MAX(connection_count) — peak parallelism for this session
     *   - refresh last_updated, completion_status, completion_percent
     *   - leave first_seen_at and download_count/stream_count alone (set elsewhere)
     */
    @Modifying
    @Query(value = """
            INSERT INTO user_cinema_activity
              (user_id, activity_type, activity_value, session_id, file_path, file_size,
               user_agent, remote_addr, bytes_transferred, update_count,
               record_id, media_file_id, connection_count,
               completion_status, completion_percent,
               client_type, http_protocol, referer, country_code,
               download_id, cdn_url, first_seen_at, created_time, last_updated)
            VALUES
              (:userId, :activityType, :activityValue, :sessionId, :filePath, :fileSize,
               :userAgent, :remoteAddr, :bytesTransferred, 1,
               :recordId, :mediaFileId, :connectionCount,
               :completionStatus, :completionPercent,
               :clientType, :httpProtocol, :referer, :countryCode,
               :downloadId, :cdnUrl, :now, :now, :now)
            ON DUPLICATE KEY UPDATE
              activity_value     = VALUES(activity_value),
              bytes_transferred  = COALESCE(bytes_transferred, 0) + COALESCE(VALUES(bytes_transferred), 0),
              update_count       = COALESCE(update_count, 0) + 1,
              connection_count   = GREATEST(COALESCE(connection_count, 1), VALUES(connection_count)),
              user_agent         = COALESCE(VALUES(user_agent), user_agent),
              remote_addr        = COALESCE(VALUES(remote_addr), remote_addr),
              completion_status  = VALUES(completion_status),
              completion_percent = VALUES(completion_percent),
              client_type        = VALUES(client_type),
              http_protocol      = COALESCE(VALUES(http_protocol), http_protocol),
              referer            = COALESCE(VALUES(referer), referer),
              country_code       = COALESCE(VALUES(country_code), country_code),
              record_id          = COALESCE(VALUES(record_id), record_id),
              media_file_id      = COALESCE(VALUES(media_file_id), media_file_id),
              download_id        = COALESCE(VALUES(download_id), download_id),
              cdn_url            = COALESCE(VALUES(cdn_url), cdn_url),
              session_id         = COALESCE(session_id, VALUES(session_id)),
              file_size          = COALESCE(VALUES(file_size), file_size),
              last_updated       = VALUES(last_updated)
            """, nativeQuery = true)
    void upsertSession(
            @Param("userId")             Long userId,
            @Param("activityType")       String activityType,
            @Param("activityValue")      String activityValue,
            @Param("sessionId")          String sessionId,
            @Param("filePath")           String filePath,
            @Param("fileSize")           Long fileSize,
            @Param("userAgent")          String userAgent,
            @Param("remoteAddr")         String remoteAddr,
            @Param("bytesTransferred")   Long bytesTransferred,
            @Param("recordId")           Long recordId,
            @Param("mediaFileId")        String mediaFileId,
            @Param("connectionCount")    Integer connectionCount,
            @Param("completionStatus")   String completionStatus,
            @Param("completionPercent")  java.math.BigDecimal completionPercent,
            @Param("clientType")         String clientType,
            @Param("httpProtocol")       String httpProtocol,
            @Param("referer")            String referer,
            @Param("countryCode")        String countryCode,
            @Param("downloadId")         String downloadId,
            @Param("cdnUrl")             String cdnUrl,
            @Param("now")                Instant now
    );

    /**
     * Mark a (user, file, type) session as completed and increment the type-specific
     * lifetime counter. Called at the end of a successful transfer (e.g. nginx CDN
     * webhook or final 200/206 with full Content-Range).
     */
    @Modifying
    @Query(value = """
            UPDATE user_cinema_activity
            SET completion_status = 'COMPLETED',
                completion_percent = 100.00,
                last_completed_at = :now,
                last_updated = :now,
                download_count = download_count + CASE WHEN activity_type = 'DOWNLOAD' THEN 1 ELSE 0 END,
                stream_count   = stream_count   + CASE WHEN activity_type = 'STREAM'   THEN 1 ELSE 0 END,
                avg_speed_bps = :avgSpeedBps
            WHERE user_id = :userId
              AND file_path = :filePath
              AND activity_type = :activityType
            """, nativeQuery = true)
    int markCompleted(
            @Param("userId")       Long userId,
            @Param("filePath")     String filePath,
            @Param("activityType") String activityType,
            @Param("avgSpeedBps")  Long avgSpeedBps,
            @Param("now")          Instant now);

    /**
     * Most recent records the user actually completed or substantially watched/downloaded.
     * Used by {@code becauseYouWatched} as a richer source signal than watch_progress alone.
     */
    @Query("""
            SELECT a.recordId FROM UserCinemaActivityEntity a
            WHERE a.user.userId = :userId
              AND a.recordId IS NOT NULL
              AND a.activityType IN ('STREAM', 'DOWNLOAD')
            ORDER BY a.lastUpdated DESC
            """)
    List<Long> findMostRecentRecordIdsByUser(@Param("userId") Long userId, Pageable pageable);

    /** Total times this user has actually completed (downloaded fully OR finished streaming) the given record. */
    @Query("""
            SELECT COALESCE(SUM(a.downloadCount + a.streamCount), 0)
            FROM UserCinemaActivityEntity a
            WHERE a.user.userId = :userId AND a.recordId = :recordId
            """)
    long countCompletedByUserAndRecord(@Param("userId") Long userId, @Param("recordId") Long recordId);
}
