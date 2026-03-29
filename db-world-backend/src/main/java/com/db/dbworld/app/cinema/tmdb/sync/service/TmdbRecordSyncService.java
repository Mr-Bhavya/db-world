package com.db.dbworld.app.cinema.tmdb.sync.service;

import com.db.dbworld.app.cinema.common.constants.CinemaConstants.TmdbSync;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.enums.SyncStatus;
import com.db.dbworld.app.cinema.tmdb.sync.entity.TmdbRecordSyncEntity;
import com.db.dbworld.app.cinema.tmdb.sync.repository.TmdbRecordSyncRepository;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class TmdbRecordSyncService {

    private final TmdbRecordSyncRepository repository;

    private static final Duration RECHECK_INTERVAL = Duration.ofHours(TmdbSync.RECHECK_INTERVAL_DAYS);

    public boolean shouldSync(Long tmdbId, RecordType type) {

        return repository.findByTmdbIdAndRecordType(tmdbId, type)
                .map(entity -> entity.getLastCheckedAt() == null ||
                        entity.getLastCheckedAt()
                                .isBefore(Instant.now().minus(RECHECK_INTERVAL)))
                .orElse(true);
    }

    /* =====================================
       PUBLIC MARK METHODS
     ===================================== */

    public void markChecked(Long tmdbId, RecordType type) {
        update(tmdbId, type, SyncStatus.RUNNING, false);
    }

    public void markSynced(Long tmdbId, RecordType type) {
        update(tmdbId, type, SyncStatus.SUCCESS, true);
    }

    public void markFailed(Long tmdbId, RecordType type) {
        update(tmdbId, type, SyncStatus.FAILED, false);
    }

    public void markSkipped(Long tmdbId, RecordType type) {
        update(tmdbId, type, SyncStatus.SKIPPED, false);
    }

    /* =====================================
       CORE UPDATE LOGIC
     ===================================== */

    private void update(Long tmdbId,
                        RecordType type,
                        SyncStatus status,
                        boolean setSyncedTime) {

        TmdbRecordSyncEntity entity = getOrCreate(tmdbId, type);

        Instant now = Instant.now();

        entity.setLastCheckedAt(now);

        if (setSyncedTime) {
            entity.setLastSyncedAt(now);
            entity.setSyncVersion(System.currentTimeMillis());
        }

        if (status != null) {
            entity.setStatus(status);
        }

        repository.save(entity);
    }

    private TmdbRecordSyncEntity getOrCreate(Long tmdbId, RecordType type) {

        return repository.findByTmdbIdAndRecordType(tmdbId, type)
                .orElseGet(() -> TmdbRecordSyncEntity.builder()
                        .tmdbId(tmdbId)
                        .recordType(type)
                        .status(SyncStatus.SKIPPED)
                        .build());
    }

    public Instant getLastGlobalSync(RecordType type) {
        return repository.findTopByRecordTypeOrderByLastCheckedAtDesc(type)
                .map(TmdbRecordSyncEntity::getLastCheckedAt)
                .orElse(null);
    }
}