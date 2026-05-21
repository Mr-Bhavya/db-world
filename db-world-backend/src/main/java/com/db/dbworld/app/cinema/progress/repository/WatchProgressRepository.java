package com.db.dbworld.app.cinema.progress.repository;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.progress.entity.WatchProgressEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface WatchProgressRepository extends JpaRepository<WatchProgressEntity, Long> {

    Optional<WatchProgressEntity> findByUserIdAndFileId(Long userId, String fileId);

    List<WatchProgressEntity> findByUserIdAndUpdatedAtAfterOrderByUpdatedAtDesc(Long userId, Instant after);

    /**
     * Distinct record IDs the user has watched, ordered by most recent activity.
     * GROUP BY collapses multiple files-per-record (e.g. a series with several episodes)
     * to one row per record; MAX(updatedAt) gives the latest activity timestamp.
     * Used by the Continue Watching rail on Home.
     */
    @Query("""
            SELECT wp.recordId FROM WatchProgressEntity wp
            WHERE wp.userId = :userId AND wp.recordId IS NOT NULL
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

    boolean existsByUserId(Long userId);
}
