package com.db.dbworld.app.cinema.tmdb.sync.repository;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.enums.SyncStatus;
import com.db.dbworld.app.cinema.tmdb.sync.entity.TmdbRecordSyncEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TmdbRecordSyncRepository extends JpaRepository<TmdbRecordSyncEntity, Long> {

    Optional<TmdbRecordSyncEntity> findByTmdbIdAndRecordType(Long tmdbId, RecordType type);

    List<TmdbRecordSyncEntity> findByLastCheckedAtBefore(Instant time);

    Optional<TmdbRecordSyncEntity> findTopByRecordTypeOrderByLastCheckedAtDesc(RecordType type);

    /** For dashboard stats — count by sync status. */
    long countByStatus(SyncStatus status);

    /** Most recently synced entry — for "last sync at" display. */
    Optional<TmdbRecordSyncEntity> findTopByOrderByLastSyncedAtDesc();

    /* ── Admin paginated queries ── */

    Page<TmdbRecordSyncEntity> findByStatus(SyncStatus status, Pageable pageable);

    Page<TmdbRecordSyncEntity> findByRecordType(RecordType recordType, Pageable pageable);

    Page<TmdbRecordSyncEntity> findByStatusAndRecordType(SyncStatus status, RecordType recordType, Pageable pageable);

    /** Used by force-sync to fetch all records for a specific type without pagination. */
    List<TmdbRecordSyncEntity> findAllByRecordType(RecordType recordType);
}