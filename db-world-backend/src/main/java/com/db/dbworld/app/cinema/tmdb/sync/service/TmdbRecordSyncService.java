package com.db.dbworld.app.cinema.tmdb.sync.service;

import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobConfigEntity;
import com.db.dbworld.app.admin.scheduler.repository.SchedulerJobConfigRepository;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.common.constants.CinemaConstants.TmdbSync;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.enums.SyncStatus;
import com.db.dbworld.app.cinema.tmdb.sync.entity.TmdbRecordSyncEntity;
import com.db.dbworld.app.cinema.tmdb.sync.repository.TmdbRecordSyncRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

@Log4j2
@Service
@RequiredArgsConstructor
public class TmdbRecordSyncService {

    private final TmdbRecordSyncRepository repository;
    private final RecordRepository recordRepository;
    private final SchedulerJobConfigRepository schedulerConfigRepo;

    /** A RUNNING row older than this is a zombie from a crashed run and is sync-eligible again. */
    private static final Duration STALE_RUNNING_RECLAIM =
            Duration.ofHours(TmdbSync.STALE_RUNNING_RECLAIM_HOURS);

    /**
     * Resolves the recheck interval for a record type from the DB scheduler config
     * ({@code scheduler_job_config.recheck_interval_hours}), falling back to
     * {@link TmdbSync#RECHECK_INTERVAL_HOURS} when unset/invalid. Read <b>once per sync
     * run</b> by the orchestrator and passed into {@link #shouldSync} — not per record.
     */
    public Duration recheckInterval(RecordType type) {
        String jobId = (type == RecordType.MOVIE)
                ? TmdbSync.MOVIE_SYNC_JOB_ID
                : TmdbSync.TV_SYNC_JOB_ID;
        int hours = schedulerConfigRepo.findById(jobId)
                .map(SchedulerJobConfigEntity::getRecheckIntervalHours)
                .filter(h -> h > 0)
                .orElse(TmdbSync.RECHECK_INTERVAL_HOURS);
        return Duration.ofHours(hours);
    }

    public boolean shouldSync(Long tmdbId, RecordType type, Duration recheckInterval) {

        return repository.findByTmdbIdAndRecordType(tmdbId, type)
                .map(entity -> {
                    Instant lastChecked = entity.getLastCheckedAt();
                    if (lastChecked == null) {
                        return true;
                    }

                    Instant now = Instant.now();

                    // Reclaim zombies: markChecked() flips status to RUNNING *before* the
                    // refresh runs, so a crash mid-refresh leaves the row RUNNING with a
                    // recent lastCheckedAt — which the recheck gate below would skip. Any
                    // RUNNING row older than the reclaim threshold is from a dead prior run
                    // (within a run, shouldSync is evaluated before markChecked), so sync it.
                    if (entity.getStatus() == SyncStatus.RUNNING
                            && lastChecked.isBefore(now.minus(STALE_RUNNING_RECLAIM))) {
                        return true;
                    }

                    return lastChecked.isBefore(now.minus(recheckInterval));
                })
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
        markFailed(tmdbId, type, (String) null);
    }

    public void markFailed(Long tmdbId, RecordType type, String errorMessage) {
        log.debug("markFailed: tmdbId={}, type={}, error={}", tmdbId, type, errorMessage);
        TmdbRecordSyncEntity entity = getOrCreate(tmdbId, type);
        entity.setLastCheckedAt(Instant.now());
        entity.setStatus(SyncStatus.FAILED);
        entity.setErrorMessage(truncate(errorMessage, 1000));
        repository.save(entity);
    }

    public void markFailed(Long tmdbId, RecordType type, Throwable cause) {
        markFailed(tmdbId, type, rootMessage(cause));
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
            entity.setErrorMessage(null); // clear previous error on success
        }

        if (status != null) {
            entity.setStatus(status);
        }

        repository.save(entity);
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    static String rootMessage(Throwable t) {
        if (t == null) return null;
        Throwable cause = t;
        while (cause.getCause() != null) {
            cause = cause.getCause();
        }
        String msg = cause.getMessage();
        return (msg != null && !msg.isBlank()) ? msg : t.getMessage();
    }

    private TmdbRecordSyncEntity getOrCreate(Long tmdbId, RecordType type) {

        return repository.findByTmdbIdAndRecordType(tmdbId, type)
                .map(existing -> {
                    // Self-heal legacy rows: recordId was only set on create, so rows
                    // that pre-date the population logic (or were created before their
                    // RecordEntity existed) stay null forever. Populate on first touch.
                    if (existing.getRecordId() == null) {
                        recordRepository.findByTmdb_Id(tmdbId)
                                .ifPresent(r -> existing.setRecordId(r.getId()));
                    }
                    return existing;
                })
                .orElseGet(() -> {
                    Long recordId = recordRepository.findByTmdb_Id(tmdbId)
                            .map(r -> r.getId())
                            .orElse(null);
                    return TmdbRecordSyncEntity.builder()
                            .tmdbId(tmdbId)
                            .recordType(type)
                            .recordId(recordId)
                            .status(SyncStatus.SKIPPED)
                            .build();
                });
    }

    public Instant getLastGlobalSync(RecordType type) {
        return repository.findTopByRecordTypeOrderByLastCheckedAtDesc(type)
                .map(TmdbRecordSyncEntity::getLastCheckedAt)
                .orElse(null);
    }
}