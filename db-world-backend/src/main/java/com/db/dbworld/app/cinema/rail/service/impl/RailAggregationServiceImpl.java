package com.db.dbworld.app.cinema.rail.service.impl;

import com.db.dbworld.app.cinema.rail.dto.RailAggregationResult;
import com.db.dbworld.app.cinema.rail.service.RailAggregationService;
import com.db.dbworld.app.cinema.tmdb.enums.VideoSite;
import com.db.dbworld.app.cinema.tmdb.enums.VideoType;
import com.db.dbworld.app.cinema.tmdb.genre.dto.TmdbGenreProjection;
import com.db.dbworld.app.cinema.tmdb.genre.repository.GenreRepository;
import com.db.dbworld.app.cinema.tmdb.media.projection.*;
import com.db.dbworld.app.cinema.tmdb.media.repository.*;
import com.db.dbworld.app.cinema.tmdb.providers.dto.ProviderProjection;
import com.db.dbworld.app.cinema.tmdb.providers.dto.TmdbProviderDto;
import com.db.dbworld.app.cinema.tmdb.providers.mapper.TmdbProviderMapper;
import com.db.dbworld.app.cinema.tmdb.providers.repository.TmdbProviderRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.Supplier;
import java.util.stream.Collectors;

@Log4j2
@Service
@RequiredArgsConstructor
public class RailAggregationServiceImpl implements RailAggregationService {

    private final PosterImageRepository posterImageRepository;
    private final BackdropImageRepository backdropImageRepository;
    private final VideoRepository videoRepository;
    private final TmdbProviderRepository tmdbProviderRepository;
    private final GenreRepository genreRepository;
    private final TmdbProviderMapper providerMapper;

    /* ═══════════════════════════════════════════════════════════
       CONSTANTS
    ═══════════════════════════════════════════════════════════ */

    private static final String REGION = "IN";

    /** Rotate among top-N candidates per tmdbId. */
    private static final int ROTATE_TOP_N = 3;

    /** Hours per rotation window. */
    private static final int ROTATE_HOURS = 6;

    /** Locale priority — index 0 = highest. */
    private static final List<String> LOCALE_PRIORITY = List.of("en", "hi", "gu");

    /** Minimum image height to consider. Below this = filtered out. */
    private static final int MIN_HEIGHT = 300;

    private static final Map<VideoType, Integer> VIDEO_PRIORITY = Map.of(
            VideoType.TRAILER,           3,
            VideoType.TEASER,            2,
            VideoType.CLIP,              1,
            VideoType.FEATURETTE,        0,
            VideoType.BEHIND_THE_SCENES, 0
    );

    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    /* ═══════════════════════════════════════════════════════════
       AGGREGATE
    ═══════════════════════════════════════════════════════════ */

    @Override
    public RailAggregationResult aggregate(List<Long> tmdbIds) {

        if (tmdbIds == null || tmdbIds.isEmpty()) return RailAggregationResult.empty();

        log.debug("RailAggregation: ids={}", tmdbIds.size());

        var genres    = async(() -> fetchGenres(tmdbIds));
        var posters   = async(() -> fetchPosters(tmdbIds));
        var backdrops = async(() -> fetchBackdrops(tmdbIds));
        var videos    = async(() -> fetchVideos(tmdbIds));
        var providers = async(() -> fetchProviders(tmdbIds));

        CompletableFuture.allOf(genres, posters, backdrops, videos, providers).join();

        return new RailAggregationResult(
                genres.getNow(Map.of()),
                posters.getNow(Map.of()),
                backdrops.getNow(Map.of()),
                videos.getNow(Map.of()),
                providers.getNow(Map.of())
        );
    }

    /* ═══════════════════════════════════════════════════════════
       FETCH
    ═══════════════════════════════════════════════════════════ */

    private Map<Long, List<String>> fetchGenres(List<Long> ids) {
        return collect(
                genreRepository.findGenresByTmdbIds(ids),
                TmdbGenreProjection::getTmdbId,
                g -> g.getTmdbId() != null && g.getGenre() != null,
                null,
                g -> g.getGenre().getName());
    }

    private Map<Long, List<PosterImageProjection>> fetchPosters(List<Long> ids) {

        var map = collect(
                posterImageRepository.findPostersByTmdbIds(ids),
                PosterImageProjection::getTmdbId,
                validImage(PosterImageProjection::getTmdbId, PosterImageProjection::getHeight),
                localeOrder(PosterImageProjection::getIso6391));

        applyRotation(map);
        return map;
    }

    private Map<Long, List<BackdropImageProjection>> fetchBackdrops(List<Long> ids) {

        var map = collect(
                backdropImageRepository.findBackdropsByTmdbIds(ids),
                BackdropImageProjection::getTmdbId,
                validImage(BackdropImageProjection::getTmdbId, BackdropImageProjection::getHeight),
                localeOrder(BackdropImageProjection::getIso6391));

        applyRotation(map);
        return map;
    }

    private Map<Long, List<VideoProjection>> fetchVideos(List<Long> ids) {
        return collect(
                videoRepository.findVideos(ids, VideoSite.YOUTUBE),
                VideoProjection::getTmdbId,
                v -> v.getTmdbId() != null && v.getKey() != null,
                Comparator.<VideoProjection, Integer>comparing(
                        v -> VIDEO_PRIORITY.getOrDefault(v.getType(), 0),
                        Comparator.reverseOrder()));
    }

    private Map<Long, List<TmdbProviderDto>> fetchProviders(List<Long> ids) {
        return collect(
                tmdbProviderRepository.findProvidersByTmdbIdIn(ids, REGION),
                ProviderProjection::getTmdbId,
                p -> p.getTmdbId() != null,
                null,
                providerMapper::fromProjection);
    }

    /* ═══════════════════════════════════════════════════════════
       GENERIC COLLECT
    ═══════════════════════════════════════════════════════════ */

    private <T> Map<Long, List<T>> collect(
            List<T> items,
            Function<T, Long> idFn,
            Predicate<T> valid,
            Comparator<T> order) {
        return collect(items, idFn, valid, order, Function.identity());
    }

    private <T, V> Map<Long, List<V>> collect(
            List<T> items,
            Function<T, Long> idFn,
            Predicate<T> valid,
            Comparator<T> order,
            Function<T, V> mapper) {

        var stream = items.stream().filter(valid);
        if (order != null) stream = stream.sorted(order);

        return stream.collect(Collectors.groupingBy(
                idFn,
                HashMap::new,
                Collectors.mapping(mapper, Collectors.toCollection(ArrayList::new))));
    }

    /* ═══════════════════════════════════════════════════════════
       IMAGE FILTER — min height gate (not ranking)
    ═══════════════════════════════════════════════════════════ */

    private <T> Predicate<T> validImage(
            Function<T, Long> idFn,
            Function<T, Integer> heightFn) {
        return item -> {
            if (idFn.apply(item) == null) return false;
            Integer h = heightFn.apply(item);
            return h == null || h >= MIN_HEIGHT;
        };
    }

    /* ═══════════════════════════════════════════════════════════
       LOCALE SCORING — iso-only, no height ranking
    ═══════════════════════════════════════════════════════════ */

    /**
     * Sorts images purely by locale relevance.
     *
     *   en → 300,  hi → 200,  gu → 100
     *   null (titleless) → 50
     *   any other locale → 10
     *
     * Within same locale → original DB order (no height bias).
     */
    private <T> Comparator<T> localeOrder(Function<T, String> isoFn) {
        return Comparator.<T, Integer>comparing(
                img -> localeScore(isoFn.apply(img)),
                Comparator.reverseOrder());
    }

    private static int localeScore(String iso) {
        if (iso == null) return 50;
        int idx = LOCALE_PRIORITY.indexOf(iso);
        return idx >= 0 ? (LOCALE_PRIORITY.size() - idx) * 100 : 10;
    }

    /* ═══════════════════════════════════════════════════════════
       ROTATION — clock-based, tmdbId-aware, restart-safe
    ═══════════════════════════════════════════════════════════ */

    /**
     * Rotates the "first pick" among the top-N candidates per tmdbId.
     *
     * - Wall clock seed  → survives server restart
     * - tmdbId mixed in  → different movies rotate at different phases
     * - Deterministic     → CDN/cache friendly within same window
     */
    private static <T> void applyRotation(Map<Long, List<T>> map) {
        if (ROTATE_TOP_N <= 1 || ROTATE_HOURS <= 0) return;

        long window = System.currentTimeMillis() / (1000L * 60 * 60 * ROTATE_HOURS);

        map.forEach((tmdbId, list) -> {
            if (list.size() <= 1) return;
            int n = Math.min(ROTATE_TOP_N, list.size());
            int pick = (int) (((tmdbId * 31 + window) % n + n) % n);
            if (pick != 0) Collections.swap(list, 0, pick);
        });
    }

    /* ═══════════════════════════════════════════════════════════
       ASYNC
    ═══════════════════════════════════════════════════════════ */

    private <T> CompletableFuture<T> async(Supplier<T> task) {
        return CompletableFuture.supplyAsync(task, executor)
                .exceptionally(ex -> {
                    log.error("Aggregation task failed", ex);
                    return null;
                });
    }
}