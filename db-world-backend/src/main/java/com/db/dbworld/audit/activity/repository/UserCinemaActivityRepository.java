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
     *   - accumulate bytes_transferred (parallel range requests sum)
     *   - take MAX(connection_count) — peak parallelism for this session
     *   - refresh last_updated, completion_status, completion_percent
     *   - leave first_seen_at and download_count/stream_count alone (set elsewhere)
     */
    @Modifying
    @Query(value = """
            INSERT INTO user_cinema_activity
              (user_id, activity_type, activity_value, session_id, file_path, file_size,
               user_agent, remote_addr, bytes_transferred,
               record_id, media_file_id, connection_count,
               completion_status, completion_percent,
               client_type,
               download_id, cdn_url, first_seen_at, created_time, last_updated,
               download_count, stream_count)
            VALUES
              (:userId, :activityType, :activityValue, :sessionId, :filePath, :fileSize,
               :userAgent, :remoteAddr, :bytesTransferred,
               :recordId, :mediaFileId, :connectionCount,
               :completionStatus, :completionPercent,
               :clientType,
               :downloadId, :cdnUrl, :now, :now, :now,
               0, 0)
            ON DUPLICATE KEY UPDATE
              activity_value     = VALUES(activity_value),
              bytes_transferred  = COALESCE(bytes_transferred, 0) + COALESCE(VALUES(bytes_transferred), 0),
              connection_count   = GREATEST(COALESCE(connection_count, 1), VALUES(connection_count)),
              user_agent         = COALESCE(VALUES(user_agent), user_agent),
              remote_addr        = COALESCE(VALUES(remote_addr), remote_addr),
              completion_status  = VALUES(completion_status),
              completion_percent = VALUES(completion_percent),
              client_type        = VALUES(client_type),
              record_id          = COALESCE(VALUES(record_id), record_id),
              media_file_id      = COALESCE(VALUES(media_file_id), media_file_id),
              download_id        = COALESCE(VALUES(download_id), download_id),
              cdn_url            = COALESCE(VALUES(cdn_url), cdn_url),
              session_id         = COALESCE(session_id, VALUES(session_id)),
              file_size          = COALESCE(VALUES(file_size), file_size),
              last_updated       = VALUES(last_updated)
              -- download_count / stream_count intentionally untouched here; they are
              -- only bumped by markCompleted() once a transfer fully finishes.
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

    /* =========================================================================
       LOG SHIPPER — bulk update from nginx-log aggregation (added 2026-05-26)
       ========================================================================= */

    /**
     * Update a (user, file, type) row from the log shipper's per-download_id aggregate.
     * Writes are absolute values (idempotent on re-read after restart). Lifetime counters
     * are bumped only on the first transition into COMPLETED — guarded by the
     * {@code completion_status &lt;&gt; 'COMPLETED'} predicate at update time.
     */
    @Modifying
    @Query(value = """
            UPDATE user_cinema_activity
            SET bytes_transferred  = :bytesTransferred,
                file_size          = COALESCE(:fileSize, file_size),
                completion_percent = COALESCE(:completionPercent, completion_percent),
                avg_speed_bps      = COALESCE(:avgSpeedBps, avg_speed_bps),
                connection_count   = GREATEST(COALESCE(connection_count, 1), :connectionCount),
                client_type        = CASE WHEN client_type = 'UNKNOWN' OR client_type IS NULL
                                          THEN :clientType ELSE client_type END,
                remote_addr        = COALESCE(:remoteAddr, remote_addr),
                last_updated       = :lastUpdated,
                last_completed_at  = CASE
                    WHEN :completionStatus = 'COMPLETED' AND last_completed_at IS NULL THEN :lastUpdated
                    ELSE last_completed_at
                END,
                download_count = download_count + CASE
                    WHEN :completionStatus = 'COMPLETED'
                     AND completion_status <> 'COMPLETED'
                     AND activity_type = 'DOWNLOAD' THEN 1 ELSE 0
                END,
                stream_count = stream_count + CASE
                    WHEN :completionStatus = 'COMPLETED'
                     AND completion_status <> 'COMPLETED'
                     AND activity_type = 'STREAM' THEN 1 ELSE 0
                END,
                completion_status  = :completionStatus
            WHERE download_id = :downloadId
            """, nativeQuery = true)
    int updateFromShipper(
            @Param("downloadId")        String downloadId,
            @Param("bytesTransferred")  long bytesTransferred,
            @Param("fileSize")          Long fileSize,
            @Param("completionPercent") java.math.BigDecimal completionPercent,
            @Param("avgSpeedBps")       Long avgSpeedBps,
            @Param("connectionCount")   int connectionCount,
            @Param("clientType")        String clientType,
            @Param("remoteAddr")        String remoteAddr,
            @Param("lastUpdated")       Instant lastUpdated,
            @Param("completionStatus")  String completionStatus
    );

    /**
     * Mark stalled (user, file, type) rows as ABORTED. One call per ActivityType so the
     * timeout threshold can differ for STREAM vs DOWNLOAD. Skipped rows that are already
     * COMPLETED or that have reached ≥95% coverage.
     */
    @Modifying
    @Query(value = """
            UPDATE user_cinema_activity
            SET completion_status = 'ABORTED',
                last_updated      = :now
            WHERE completion_status IN ('STARTED', 'IN_PROGRESS')
              AND COALESCE(completion_percent, 0) < 95
              AND activity_type = :activityType
              AND last_updated < :timeoutCutoff
            """, nativeQuery = true)
    int sweepAbortedByType(
            @Param("activityType")  String activityType,
            @Param("timeoutCutoff") Instant timeoutCutoff,
            @Param("now")           Instant now
    );

    /* =========================================================================
       PHASE 3 — watch_progress bridge (added 2026-05-26)
       ========================================================================= */

    /**
     * Set {@code watch_progress_id} on the row identified by the natural key
     * (user_id, file_path, activity_type), only if the FK is currently NULL.
     * Concurrency-safe: a parallel writer that already set the FK is a no-op here.
     * Used at {@code /resolve} time when the watch_progress row already exists.
     */
    @Modifying
    @Query(value = """
            UPDATE user_cinema_activity
            SET watch_progress_id = :watchProgressId
            WHERE user_id        = :userId
              AND file_path      = :filePath
              AND activity_type  = :activityType
              AND watch_progress_id IS NULL
            """, nativeQuery = true)
    int setWatchProgressIdByKey(
            @Param("userId")          Long userId,
            @Param("filePath")        String filePath,
            @Param("activityType")    String activityType,
            @Param("watchProgressId") Long watchProgressId
    );

    /**
     * Set {@code watch_progress_id} by row id, only if currently NULL. Used at
     * watch_progress save time after the FK was unset at /resolve (race-safe).
     */
    @Modifying
    @Query(value = """
            UPDATE user_cinema_activity
            SET watch_progress_id = :watchProgressId
            WHERE id = :id
              AND watch_progress_id IS NULL
            """, nativeQuery = true)
    int setWatchProgressIdById(
            @Param("id")              Long id,
            @Param("watchProgressId") Long watchProgressId
    );

    /**
     * Find the canonical STREAM-or-DOWNLOAD activity row for a given media file. Used by
     * the watch-progress save path to backfill {@code watch_progress_id} on the activity
     * row when the {@code /resolve} call happened before the watch_progress row existed.
     */
    @Query("""
            SELECT a FROM UserCinemaActivityEntity a
            WHERE a.user.userId   = :userId
              AND a.mediaFileId   = :mediaFileId
              AND a.activityType  = :activityType
            """)
    Optional<UserCinemaActivityEntity> findByUserIdAndMediaFileIdAndActivityType(
            @Param("userId")        Long userId,
            @Param("mediaFileId")   String mediaFileId,
            @Param("activityType") UserCinemaActivityEntity.ActivityType activityType
    );

    /**
     * Paginated activity view joining watch_progress (live cursor for streams) and
     * records (catalog title/type). LEFT JOINs because:
     * <ul>
     *   <li>watch_progress is null for DOWNLOAD rows and for streams the user hasn't
     *       ticked yet — both legitimate;</li>
     *   <li>records is null for legacy rows whose record_id backfill found no match.</li>
     * </ul>
     *
     * <p>Phase 4 wires this to {@code GET /api/me/activity}.
     */
    @Query(value = """
            SELECT
                uca.id                    AS id,
                uca.activity_type         AS activityType,
                uca.record_id             AS recordId,
                r.name                    AS recordTitle,
                r.type                    AS recordType,
                uca.file_path             AS filePath,
                uca.file_size             AS fileSize,
                uca.media_file_id         AS mediaFileId,
                uca.completion_status     AS completionStatus,
                uca.completion_percent    AS completionPercent,
                uca.download_count        AS downloadCount,
                uca.stream_count          AS streamCount,
                uca.client_type           AS clientType,
                uca.avg_speed_bps         AS avgSpeedBps,
                uca.last_updated          AS lastUpdated,
                uca.last_completed_at     AS lastCompletedAt,
                wp.position_ms            AS positionMs,
                wp.duration_ms            AS durationMs,
                wp.audio_lang             AS audioLang,
                wp.sub_lang               AS subLang
            FROM user_cinema_activity uca
            LEFT JOIN watch_progress wp ON wp.id = uca.watch_progress_id
            LEFT JOIN records r ON r.id = uca.record_id
            WHERE uca.user_id = :userId
              AND (:activityType IS NULL OR uca.activity_type = :activityType)
            ORDER BY uca.last_updated DESC
            LIMIT :limit OFFSET :offset
            """, nativeQuery = true)
    List<com.db.dbworld.audit.activity.dto.UserActivityProjection> findUserActivityView(
            @Param("userId")       Long userId,
            @Param("activityType") String activityType,
            @Param("limit")        int limit,
            @Param("offset")       int offset
    );
}
