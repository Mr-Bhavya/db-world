package com.db.dbworld.app.cinema.tmdb.sync.scheduler;

import com.db.dbworld.app.admin.scheduler.dto.JobRunSummary;
import com.db.dbworld.app.cinema.common.constants.CinemaConstants.TmdbSync;
import com.db.dbworld.app.cinema.common.events.BulkRecordChangedEvent;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.sync.dto.SyncMetrics;
import com.db.dbworld.app.cinema.tmdb.sync.dto.SyncWindow;
import com.db.dbworld.app.cinema.tmdb.sync.service.TmdbRecordSyncService;
import com.db.dbworld.app.cinema.tmdb.sync.service.TmdbSyncOrchestratorService;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.time.*;
import java.util.Map;


@Component
@RequiredArgsConstructor
@Log4j2
public class TmdbSyncScheduler {

    private final TmdbSyncOrchestratorService syncService;
    private final TmdbRecordSyncService syncStateService;
    private final ApplicationEventPublisher applicationEventPublisher;

    public void runMovieSync(JobRunSummary.Builder summary) {
        runSync(RecordType.MOVIE, summary);
    }

    public void runTvSync(JobRunSummary.Builder summary) {
        runSync(RecordType.TV_SERIES, summary);
    }

    /* =====================================
       GENERIC SYNC
     ===================================== */

    private void runSync(RecordType type, JobRunSummary.Builder summary) {

        long start = System.currentTimeMillis();

        try {
            SyncWindow window = computeWindow(type);

            log.info("TMDB sync run started; type={}; window={}", type, window);

            // Owned here, not inside the orchestrator, so the admin page can watch these
            // climb during a run that takes minutes instead of staring at a spinner.
            SyncMetrics metrics = new SyncMetrics();
            summary.progress(() -> Map.of(
                    "changed", (long) metrics.getTotal().get(),
                    "synced",  (long) metrics.getSuccess().get(),
                    "failed",  (long) metrics.getFailed().get(),
                    "skipped", (long) metrics.getSkipped().get()));

            if (type == RecordType.MOVIE) {
                syncService.syncMovies(window, metrics);
            } else {
                syncService.syncTv(window, metrics);
            }

            long elapsed = System.currentTimeMillis() - start;
            log.info("TMDB sync completed; type={}; summary={}; took={}ms", type, metrics.summary(), elapsed);
            report(summary, metrics);

            applicationEventPublisher.publishEvent(new BulkRecordChangedEvent());
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("TMDB sync aborted; type={}; took={}ms", type, elapsed, e);
            throw e;
        }
    }

    /**
     * Copies the run's metrics onto the history row. These are the numbers that answer the
     * question the admin page previously couldn't: whether a 400-second "SUCCESS" touched
     * four hundred records or none.
     */
    private void report(JobRunSummary.Builder summary, SyncMetrics metrics) {
        summary.count("changed", metrics.getTotal().get())
               .count("synced",  metrics.getSuccess().get())
               .count("failed",  metrics.getFailed().get())
               .count("skipped", metrics.getSkipped().get());
        if (metrics.getTotal().get() == 0) {
            summary.note("TMDB reported no changes in the window — nothing to sync");
        }
    }

    /* =====================================
       WINDOW LOGIC
     ===================================== */

    private SyncWindow computeWindow(RecordType type) {

        Instant now = Instant.now();
        Instant maxLookback = now.minus(Duration.ofDays(TmdbSync.MAX_WINDOW_DAYS));

        Instant lastSync = syncStateService.getLastGlobalSync(type);

        Instant start = (lastSync == null)
                ? maxLookback
                : lastSync.minus(Duration.ofDays(TmdbSync.BUFFER_DAYS));

        if (start.isBefore(maxLookback)) {
            start = maxLookback;
        }

        return new SyncWindow(start, now);
    }

}
