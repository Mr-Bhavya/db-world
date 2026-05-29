package com.db.dbworld.app.cinema.tmdb.sync.scheduler;

import com.db.dbworld.app.cinema.common.constants.CinemaConstants.Scheduler;
import com.db.dbworld.app.cinema.common.constants.CinemaConstants.Time;
import com.db.dbworld.app.cinema.common.constants.CinemaConstants.TmdbSync;
import com.db.dbworld.app.cinema.common.events.BulkRecordChangedEvent;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.sync.dto.SyncMetrics;
import com.db.dbworld.app.cinema.tmdb.sync.dto.SyncWindow;
import com.db.dbworld.app.cinema.tmdb.sync.service.TmdbRecordSyncService;
import com.db.dbworld.app.cinema.tmdb.sync.service.TmdbSyncOrchestratorService;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

import org.apache.logging.log4j.ThreadContext;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.time.*;
import java.util.UUID;


@Component
@RequiredArgsConstructor
@Log4j2
public class TmdbSyncScheduler {

    private final TmdbSyncOrchestratorService syncService;
    private final TmdbRecordSyncService syncStateService;
    private final ApplicationEventPublisher applicationEventPublisher;

    public void runMovieSync() {
        runSync(RecordType.MOVIE);
    }

    public void runTvSync() {
        runSync(RecordType.TV_SERIES);
    }

    /* =====================================
       GENERIC SYNC
     ===================================== */

    private void runSync(RecordType type) {

        ThreadContext.put("traceId", UUID.randomUUID().toString());
        long start = System.currentTimeMillis();

        try {
            SyncWindow window = computeWindow(type);

            log.info("TMDB sync run started; type={}; window={}", type, window);

            SyncMetrics metrics;

            if (type == RecordType.MOVIE) {
                metrics = syncService.syncMovies(window);
            } else {
                metrics = syncService.syncTv(window);
            }

            long elapsed = System.currentTimeMillis() - start;
            log.info("TMDB sync completed; type={}; summary={}; took={}ms", type, metrics.summary(), elapsed);

            applicationEventPublisher.publishEvent(new BulkRecordChangedEvent());
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("TMDB sync aborted; type={}; took={}ms", type, elapsed, e);
            throw e;
        } finally {
            ThreadContext.clearAll();
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