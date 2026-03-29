package com.db.dbworld.app.cinema.tmdb.sync.service;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.common.constants.CinemaConstants.TmdbSync;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.ingestion.TmdbIngestionService;
import com.db.dbworld.app.cinema.tmdb.service.TmdbService;

import com.db.dbworld.app.cinema.tmdb.sync.dto.SyncMetrics;
import com.db.dbworld.app.cinema.tmdb.sync.dto.SyncWindow;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Log4j2
public class TmdbSyncOrchestratorService {

    private final TmdbService tmdbService;
    private final RecordRepository recordRepository;
    private final TmdbRecordSyncService syncService;
    private final TmdbIngestionService ingestionService;

    /* =====================================
       PUBLIC ENTRY
     ===================================== */

    public SyncMetrics syncMovies(SyncWindow window) {
        return sync(window, RecordType.MOVIE);
    }

    public SyncMetrics syncTv(SyncWindow window) {
        return sync(window, RecordType.TV_SERIES);
    }

    /* =====================================
       CORE SYNC ENGINE
     ===================================== */

    private SyncMetrics sync(SyncWindow window, RecordType type) {

        SyncMetrics metrics = new SyncMetrics();

        List<Long> changedIds = fetchTmdbChangedIds(window.startDate(), window.endDate(), type);

        if (changedIds.isEmpty()) {
            log.info("No {} changes found", type);
            return metrics;
        }

        log.info("{} changes fetched: {}", type, changedIds.size());

        Map<Long, RecordEntity> recordMap =
                recordRepository.findByTmdbIdIn(changedIds)
                        .stream()
                        .collect(Collectors.toMap(RecordEntity::getTmdbId, r -> r));

        Flux.fromIterable(changedIds)
                .filter(recordMap::containsKey)
                .doOnNext(id -> metrics.incrementTotal())
                .delayElements(Duration.ofMillis(TmdbSync.DELAY_MS))
                .flatMap(id -> processSingle(id, recordMap.get(id), type, metrics),
                        TmdbSync.PARALLELISM)
                .doOnError(e -> log.error("Sync pipeline error", e))
                .blockLast();

        return metrics;
    }

    /* =====================================
       FETCH CHANGES
     ===================================== */

    private List<Long> fetchTmdbChangedIds(String startDate, String endDate, RecordType type) {

        List<Long> ids;

        if (type == RecordType.MOVIE) {
            ids = tmdbService.fetchAllMovieChanges(startDate, endDate)
                    .distinct()
                    .collectList()
                    .block();
        } else {
            ids = tmdbService.fetchAllTvChanges(startDate, endDate)
                    .distinct()
                    .collectList()
                    .block();
        }

        return ids == null ? Collections.emptyList() : ids;
    }

    /* =====================================
       SINGLE RECORD PROCESS
     ===================================== */

    private Mono<Void> processSingle(Long tmdbId,
                                     RecordEntity record,
                                     RecordType type,
                                     SyncMetrics metrics) {

        if (record == null) return Mono.empty();

        return Mono.fromRunnable(() -> {

            if (!syncService.shouldSync(tmdbId, type)) {
                syncService.markSkipped(tmdbId, type);
                metrics.incrementSkipped();
                return;
            }

            syncService.markChecked(tmdbId, type);

            try {

                if (type == RecordType.MOVIE) {
                    ingestionService.refreshMovie(tmdbId);
                } else {
                    ingestionService.refreshTvSeries(tmdbId);
                }

                syncService.markSynced(tmdbId, type);
                metrics.incrementSuccess();

            } catch (Exception e) {
                log.error("{} sync failed: {}", type, tmdbId, e);

                syncService.markFailed(tmdbId, type);
                metrics.incrementFailed();
            }

        }).subscribeOn(Schedulers.boundedElastic()).then();
    }
}