package com.db.dbworld.hls;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface HLSPlaybackSessionRepository extends JpaRepository<HLSPlaybackSessionEntity, Long> {

    Optional<HLSPlaybackSessionEntity> findBySessionId(String sessionId);

    List<HLSPlaybackSessionEntity> findByUserId(Long userId);

//    List<HLSPlaybackSessionEntity> findByHlsContentId(Long hlsContentId);

    List<HLSPlaybackSessionEntity> findByStartedAtAfter(LocalDateTime startTime);

    List<HLSPlaybackSessionEntity> findByStartedAtBefore(LocalDateTime endTime);

    List<HLSPlaybackSessionEntity> findByRecordId(Long recordId);

    List<HLSPlaybackSessionEntity> findByStatus(HLSPlaybackStatus status);

    @Query("SELECT s FROM HLSPlaybackSessionEntity s WHERE s.userId = :userId AND s.recordId = :recordId ORDER BY s.startedAt DESC")
    List<HLSPlaybackSessionEntity> findByUserIdAndRecordId(@Param("userId") Long userId,
                                                           @Param("recordId") Long recordId);

    @Query("SELECT s FROM HLSPlaybackSessionEntity s WHERE s.startedAt BETWEEN :startDate AND :endDate")
    List<HLSPlaybackSessionEntity> findSessionsBetweenDates(@Param("startDate") LocalDateTime startDate,
                                                            @Param("endDate") LocalDateTime endDate);

    @Query("SELECT COUNT(s) FROM HLSPlaybackSessionEntity s WHERE s.recordId = :recordId")
    long countByRecordId(@Param("recordId") Long recordId);

    @Query("SELECT s FROM HLSPlaybackSessionEntity s WHERE s.lastHeartbeat < :cutoffTime AND s.status = 'ACTIVE'")
    List<HLSPlaybackSessionEntity> findStaleSessions(@Param("cutoffTime") LocalDateTime cutoffTime);

    @Modifying
    @Query("UPDATE HLSPlaybackSessionEntity s SET s.status = 'COMPLETED' WHERE s.sessionId = :sessionId")
    void markAsCompleted(@Param("sessionId") String sessionId);

    @Modifying
    @Query("UPDATE HLSPlaybackSessionEntity s SET s.status = :status WHERE s.sessionId = :sessionId")
    void updateStatus(@Param("sessionId") String sessionId, @Param("status") HLSPlaybackStatus status);

    @Modifying
    @Query("UPDATE HLSPlaybackSessionEntity s SET s.currentTime = :currentTime, s.lastHeartbeat = :now WHERE s.sessionId = :sessionId")
    void updateHeartbeat(@Param("sessionId") String sessionId,
                         @Param("currentTime") Double currentTime,
                         @Param("now") LocalDateTime now);

    @Query("SELECT COUNT(DISTINCT s.userId) FROM HLSPlaybackSessionEntity s WHERE s.recordId = :recordId")
    long countUniqueUsersByRecordId(@Param("recordId") Long recordId);

    @Query("SELECT s FROM HLSPlaybackSessionEntity s WHERE s.endedAt IS NULL AND s.startedAt < :cutoffTime")
    List<HLSPlaybackSessionEntity> findAbandonedSessions(@Param("cutoffTime") LocalDateTime cutoffTime);

    void deleteByHlsContentId(String id);
}
