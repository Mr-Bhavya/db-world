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
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Log4j2
public class TmdbSyncOrchestratorService {

    private final TmdbService tmdbService;
    private final RecordRepository recordRepository;
    private final TmdbRecordSyncService syncService;
    private final TmdbIngestionService ingestionService;

    /**
     * After this many per-record WARN logs in a single sync run, the orchestrator
     * stops emitting individual warnings and tracks an aggregate count so a flood
     * of TMDB failures cannot blow out the log volume.
     */
    private static final int PER_RECORD_WARN_SAMPLE = 50;

    /* =====================================
       PUBLIC ENTRY
     ===================================== */

    public SyncMetrics syncMovies(SyncWindow window) {
        log.debug("syncMovies entry; window={}", window);
        return sync(window, RecordType.MOVIE);
    }

    public SyncMetrics syncTv(SyncWindow window) {
        log.debug("syncTv entry; window={}", window);
        return sync(window, RecordType.TV_SERIES);
    }

    /* =====================================
       CORE SYNC ENGINE
     ===================================== */

    private SyncMetrics sync(SyncWindow window, RecordType type) {

        SyncMetrics metrics = new SyncMetrics();
        AtomicInteger warnCount = new AtomicInteger();

        List<Long> changedIds = fetchTmdbChangedIds(window.startDate(), window.endDate(), type);

        if (changedIds.isEmpty()) {
            log.info("No {} changes found", type);
            return metrics;
        }

        log.info("{} changes fetched: count={}", type, changedIds.size());

        // Filter by RecordType: TMDB movie IDs and TV IDs are independent numeric
        // spaces. Without this, movie sync would pick up TV records that happen to
        // share a numeric ID, causing SINGLE_TABLE discriminator mismatch and the
        // "Duplicate entry … for key 'tmdb_data.PRIMARY'" insert.
        Map<Long, RecordEntity> recordMap =
                recordRepository.findByTmdbIdInAndType(changedIds, type)
                        .stream()
                        .collect(Collectors.toMap(RecordEntity::getTmdbId, r -> r, (a, b) -> a));

        log.debug("{} sync matched {} local records from {} TMDB changes",
                type, recordMap.size(), changedIds.size());

        Flux.fromIterable(changedIds)
                .filter(recordMap::containsKey)
                .doOnNext(id -> metrics.incrementTotal())
                .delayElements(Duration.ofMillis(TmdbSync.DELAY_MS))
                .flatMap(id -> processSingle(id, recordMap.get(id), type, metrics, warnCount),
                        TmdbSync.PARALLELISM)
                .doOnError(e -> log.error("{} sync pipeline error", type, e))
                .blockLast();

        int suppressed = Math.max(0, warnCount.get() - PER_RECORD_WARN_SAMPLE);
        if (suppressed > 0) {
            log.warn("{} sync: suppressed {} additional per-record failure warnings (total failures={})",
                    type, suppressed, warnCount.get());
        }

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
                                     SyncMetrics metrics,
                                     AtomicInteger warnCount) {

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
                int n = warnCount.incrementAndGet();
                if (n <= PER_RECORD_WARN_SAMPLE) {
                    log.warn("{} sync failed; tmdbId={}", type, tmdbId, e);
                } else if (n == PER_RECORD_WARN_SAMPLE + 1) {
                    log.warn("{} sync: per-record failure log suppressed after {} entries; further failures aggregated",
                            type, PER_RECORD_WARN_SAMPLE);
                }

                syncService.markFailed(tmdbId, type, e);
                metrics.incrementFailed();
            }

        }).subscribeOn(Schedulers.boundedElastic()).then();
    }
}