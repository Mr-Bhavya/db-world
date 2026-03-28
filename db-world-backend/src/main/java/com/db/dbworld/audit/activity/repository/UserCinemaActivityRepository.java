package com.db.dbworld.dao.user;

import com.db.dbworld.entities.user.UserCinemaActivityEntity;
import com.db.dbworld.core.user.entity.UserEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
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
}
