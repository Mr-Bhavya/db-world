package com.db.dbworld.app.cinema.tmdb.sync.service;

import com.db.dbworld.app.cinema.common.constants.CinemaConstants.TmdbSync;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.enums.SyncStatus;
import com.db.dbworld.app.cinema.tmdb.ingestion.TmdbIngestionService;
import com.db.dbworld.app.cinema.tmdb.sync.dto.SyncRecordDto;
import com.db.dbworld.app.cinema.tmdb.sync.dto.SyncStatsDto;
import com.db.dbworld.app.cinema.tmdb.sync.dto.SyncWindow;
import com.db.dbworld.app.cinema.tmdb.sync.entity.TmdbRecordSyncEntity;
import com.db.dbworld.app.cinema.tmdb.sync.repository.TmdbRecordSyncRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Log4j2
public class TmdbSyncAdminService {

    private final TmdbRecordSyncRepository repository;
    private final TmdbSyncOrchestratorService orchestrator;
    private final TmdbIngestionService ingestionService;
    private final TmdbRecordSyncService syncService;

    /* ── Stats ────────────────────────────────────────────────── */

    @Transactional(readOnly = true)
    public SyncStatsDto getStats() {
        long success = repository.countByStatus(SyncStatus.SUCCESS);
        long failed  = repository.countByStatus(SyncStatus.FAILED);
        long skipped = repository.countByStatus(SyncStatus.SKIPPED);
        long running = repository.countByStatus(SyncStatus.RUNNING);
        Instant lastSyncedAt = repository.findTopByOrderByLastSyncedAtDesc()
                .map(TmdbRecordSyncEntity::getLastSyncedAt)
                .orElse(null);
        return new SyncStatsDto(success, failed, skipped, running, lastSyncedAt);
    }

    /* ── Records (paginated) ──────────────────────────────────── */

    @Transactional(readOnly = true)
    public Page<SyncRecordDto> getRecords(SyncStatus status, RecordType recordType, Pageable pageable) {
        Page<TmdbRecordSyncEntity> page;

        if (status != null && recordType != null) {
            page = repository.findByStatusAndRecordType(status, recordType, pageable);
        } else if (status != null) {
            page = repository.findByStatus(status, pageable);
        } else if (recordType != null) {
            page = repository.findByRecordType(recordType, pageable);
        } else {
            page = repository.findAll(pageable);
        }

        return page.map(this::toDto);
    }

    /* ── Force Sync (re-sync every record, ignoring shouldSync guard) ── */

    public void forceSync(RecordType type) {
        List<TmdbRecordSyncEntity> targets = type != null
                ? repository.findAllByRecordType(type)
                : repository.findAll();

        log.info("Force sync queued: {} records, type={}", targets.size(), type);

        Thread.ofVirtual().name("tmdb-force-sync").start(() -> {
            int success = 0, failed = 0;
            for (TmdbRecordSyncEntity entity : targets) {
                try {
                    Thread.sleep(TmdbSync.DELAY_MS);
                    if (entity.getRecordType() == RecordType.MOVIE) {
                        ingestionService.refreshMovie(entity.getTmdbId());
                    } else {
                        ingestionService.refreshTvSeries(entity.getTmdbId());
                    }
                    syncService.markSynced(entity.getTmdbId(), entity.getRecordType());
                    success++;
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    log.warn("Force sync interrupted after {}/{} records", success + failed, targets.size());
                    break;
                } catch (Exception ex) {
                    syncService.markFailed(entity.getTmdbId(), entity.getRecordType(), ex);
                    failed++;
                }
            }
            log.info("Force sync completed: success={}, failed={}", success, failed);
        });
    }

    /* ── Trigger ──────────────────────────────────────────────── */

    public void triggerSync(RecordType type) {
        SyncWindow window = new SyncWindow(
                Instant.now().minus(Duration.ofDays(2)),
                Instant.now()
        );

        Thread.ofVirtual().name("tmdb-manual-sync").start(() -> {
            try {
                if (type == null || type == RecordType.MOVIE) {
                    log.info("Manual sync triggered: MOVIE");
                    orchestrator.syncMovies(window);
                }
                if (type == null || type == RecordType.TV_SERIES) {
                    log.info("Manual sync triggered: TV_SERIES");
                    orchestrator.syncTv(window);
                }
            } catch (Exception e) {
                log.error("Manual sync failed", e);
            }
        });
    }

    /* ── Retry ────────────────────────────────────────────────── */

    @Transactional
    public void retrySync(Long id) {
        TmdbRecordSyncEntity entity = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Sync record not found: " + id));

        Long tmdbId = entity.getTmdbId();
        RecordType type = entity.getRecordType();

        entity.setStatus(SyncStatus.RUNNING);
        entity.setLastCheckedAt(Instant.now());
        repository.save(entity);

        Thread.ofVirtual().name("tmdb-retry-" + id).start(() -> {
            try {
                if (type == RecordType.MOVIE) {
                    ingestionService.refreshMovie(tmdbId);
                } else {
                    ingestionService.refreshTvSeries(tmdbId);
                }
                TmdbRecordSyncEntity e = repository.findById(id).orElseThrow();
                e.setStatus(SyncStatus.SUCCESS);
                e.setLastSyncedAt(Instant.now());
                e.setSyncVersion(System.currentTimeMillis());
                e.setErrorMessage(null); // clear previous error on success
                repository.save(e);
                log.info("Retry succeeded: id={} tmdbId={}", id, tmdbId);
            } catch (Exception ex) {
                log.error("Retry failed: id={} tmdbId={}", id, tmdbId, ex);
                repository.findById(id).ifPresent(e -> {
                    e.setStatus(SyncStatus.FAILED);
                    e.setErrorMessage(truncate(rootMessage(ex), 1000));
                    repository.save(e);
                });
            }
        });
    }

    /* ── Mapping ──────────────────────────────────────────────── */

    private SyncRecordDto toDto(TmdbRecordSyncEntity e) {
        return new SyncRecordDto(
                e.getId(),
                e.getTmdbId(),
                e.getRecordId(),
                e.getRecordType() != null ? e.getRecordType().name() : null,
                e.getStatus() != null ? e.getStatus().name() : null,
                e.getLastCheckedAt(),
                e.getLastSyncedAt(),
                e.getSyncVersion(),
                e.getErrorMessage(),
                e.getTmdb() != null ? e.getTmdb().getTitle() : null
        );
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    /**
     * Walks the exception cause chain and returns the root cause message.
     * Falls back to the top-level message if the root has none.
     */
    static String rootMessage(Throwable t) {
        if (t == null) return null;
        Throwable cause = t;
        while (cause.getCause() != null) {
            cause = cause.getCause();
        }
        String msg = cause.getMessage();
        return (msg != null && !msg.isBlank()) ? msg : t.getMessage();
    }
}
