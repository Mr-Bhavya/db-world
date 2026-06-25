package com.db.dbworld.app.cinema.progress.repository;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.progress.entity.WatchProgressEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface WatchProgressRepository extends JpaRepository<WatchProgressEntity, Long> {

    Optional<WatchProgressEntity> findByUserIdAndFileId(Long userId, String fileId);

    List<WatchProgressEntity> findByUserIdAndUpdatedAtAfterOrderByUpdatedAtDesc(Long userId, Instant after);

    /** All of a user's progress rows, newest first (for building Continue Watching). */
    List<WatchProgressEntity> findByUserIdOrderByUpdatedAtDesc(Long userId);

    /** Remove from Continue Watching: drop all of a user's progress for one record. */
    long deleteByUserIdAndRecordId(Long userId, Long recordId);

    /** Drop a single file's progress for a user. */
    long deleteByUserIdAndFileId(Long userId, String fileId);

    /**
     * Atomic upsert. Player clients can fire two saves for the same (user, file) within
     * milliseconds; the previous find-then-insert flow raced and tripped the
     * {@code uk_user_file_progress} unique constraint. MySQL's
     * {@code ON DUPLICATE KEY UPDATE} resolves it server-side so the writer never sees
     * a duplicate-key exception.
     */
    @Modifying
    @Query(value = """
            INSERT INTO watch_progress
              (user_id, file_id, record_id, position_ms, duration_ms, audio_lang, sub_lang, updated_at)
            VALUES
              (:userId, :fileId, :recordId, :positionMs, :durationMs, :audioLang, :subLang, :updatedAt)
            ON DUPLICATE KEY UPDATE
              record_id   = VALUES(record_id),
              position_ms = VALUES(position_ms),
              duration_ms = VALUES(duration_ms),
              audio_lang  = VALUES(audio_lang),
              sub_lang    = VALUES(sub_lang),
              updated_at  = VALUES(updated_at)
            """, nativeQuery = true)
    void upsert(@Param("userId")     Long userId,
                @Param("fileId")     String fileId,
                @Param("recordId")   Long recordId,
                @Param("positionMs") Long positionMs,
                @Param("durationMs") Long durationMs,
                @Param("audioLang")  String audioLang,
                @Param("subLang")    String subLang,
                @Param("updatedAt")  Instant updatedAt);

    /**
     * Used by Continue Watching to short-circuit the rail when the user has no usable
     * progress (i.e. no entries with a resolvable recordId).
     */
    boolean existsByUserIdAndRecordIdNotNull(Long userId);

    /**
     * Distinct record IDs the user has watched, ordered by most recent activity.
     * GROUP BY collapses multiple files-per-record (e.g. a series with several episodes)
     * to one row per record; MAX(updatedAt) gives the latest activity timestamp.
     * The JOIN to RecordEntity filters out progress rows whose record has been deleted,
     * so the rail never serves dangling IDs.
     * Used by the Continue Watching rail on Home.
     */
    @Query("""
            SELECT wp.recordId FROM WatchProgressEntity wp
            JOIN com.db.dbworld.app.cinema.catalog.entities.RecordEntity r ON r.id = wp.recordId
            WHERE wp.userId = :userId
            GROUP BY wp.recordId
            ORDER BY MAX(wp.updatedAt) DESC
            """)
    Slice<Long> findRecentRecordIdsByUser(Long userId, Pageable pageable);

    /**
     * Same as {@link #findRecentRecordIdsByUser} but constrained to a specific record type.
     * Used by the Continue Watching rail on Movies / Series pages.
     */
    @Query("""
            SELECT wp.recordId FROM WatchProgressEntity wp
            JOIN com.db.dbworld.app.cinema.catalog.entities.RecordEntity r ON r.id = wp.recordId
            WHERE wp.userId = :userId AND r.type = :recordType
            GROUP BY wp.recordId
            ORDER BY MAX(wp.updatedAt) DESC
            """)
    Slice<Long> findRecentRecordIdsByUserAndType(Long userId, RecordType recordType, Pageable pageable);

    /**
     * Most recent record the user touched (with a resolvable recordId). Used by the
     * "Because you watched" rail to pick the source record.
     */
    @Query("""
            SELECT wp.recordId FROM WatchProgressEntity wp
            WHERE wp.userId = :userId AND wp.recordId IS NOT NULL
            ORDER BY wp.updatedAt DESC
            """)
    List<Long> findMostRecentRecordIdsByUser(Long userId, Pageable pageable);
}
