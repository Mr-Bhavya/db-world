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
    private final LogoImageRepository logoImageRepository;
    private final VideoRepository videoRepository;
    private final TmdbProviderRepository tmdbProviderRepository;
    private final GenreRepository genreRepository;
    private final TmdbProviderMapper providerMapper;

    /* ═══════════════════════════════════════════════════════════
       CONSTANTS
    ═══════════════════════════════════════════════════════════ */

    private static final String REGION = "IN";

    /** Locale priority — index 0 = highest. */
    private static final List<String> LOCALE_PRIORITY = List.of("en", "hi", "gu");

    /** Logo locale priority — Hindi first, then English, then regional. */
    private static final List<String> LOGO_LOCALE_PRIORITY = List.of("hi", "en", "gu");

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
        var logos     = async(() -> fetchLogos(tmdbIds));
        var videos    = async(() -> fetchVideos(tmdbIds));
        var providers = async(() -> fetchProviders(tmdbIds));

        CompletableFuture.allOf(genres, posters, backdrops, logos, videos, providers).join();

        // allOf has completed every future, so join() returns immediately. A failed
        // fetch completes with null (see async's exceptionally) — coalesce to an
        // empty map so one bad fetch degrades to fallback images instead of NPE-ing
        // the whole rail downstream.
        return new RailAggregationResult(
                orEmpty(genres.join()),
                orEmpty(posters.join()),
                orEmpty(backdrops.join()),
                orEmpty(videos.join()),
                orEmpty(providers.join()),
                orEmpty(logos.join())
        );
    }

    private static <K, V> Map<K, V> orEmpty(Map<K, V> map) {
        return map != null ? map : Map.of();
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

    // Locale-ranked only; per-variant image rotation/variety is applied downstream
    // in RailRecordBuilder (it knows which images are with-text vs clean).
    private Map<Long, List<PosterImageProjection>> fetchPosters(List<Long> ids) {
        return collect(
                posterImageRepository.findPostersByTmdbIds(ids, LOCALE_PRIORITY, MIN_HEIGHT),
                PosterImageProjection::getTmdbId,
                validImage(PosterImageProjection::getTmdbId, PosterImageProjection::getFilePath),
                localeOrder(PosterImageProjection::getIso6391));
    }

    private Map<Long, List<BackdropImageProjection>> fetchBackdrops(List<Long> ids) {
        return collect(
                backdropImageRepository.findBackdropsByTmdbIds(ids, LOCALE_PRIORITY, MIN_HEIGHT),
                BackdropImageProjection::getTmdbId,
                validImage(BackdropImageProjection::getTmdbId, BackdropImageProjection::getFilePath),
                localeOrder(BackdropImageProjection::getIso6391));
    }

    // Title logos, locale-ranked (en > hi > gu > none). Builder picks the best one.
    private Map<Long, List<LogoImageProjection>> fetchLogos(List<Long> ids) {
        return collect(
                logoImageRepository.findLogosByTmdbIds(ids, LOCALE_PRIORITY),
                LogoImageProjection::getTmdbId,
                validImage(LogoImageProjection::getTmdbId, LogoImageProjection::getFilePath),
                logoLocaleOrder(LogoImageProjection::getIso6391));
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
       IMAGE FILTER — null guard only

       Height / locale / file-path gating is pushed down to the SQL query
       (see PosterImageRepository / BackdropImageRepository), so this is just a
       cheap defensive guard against malformed projection rows.
    ═══════════════════════════════════════════════════════════ */

    private <T> Predicate<T> validImage(
            Function<T, Long> idFn,
            Function<T, String> pathFn) {
        return item -> idFn.apply(item) != null && pathFn.apply(item) != null;
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

    /**
     * Logo ordering — Hindi first, then English, then regional (gu), then
     * language-neutral (null). Title logos read best in the local language.
     */
    private <T> Comparator<T> logoLocaleOrder(Function<T, String> isoFn) {
        return Comparator.<T, Integer>comparing(
                img -> logoLocaleScore(isoFn.apply(img)),
                Comparator.reverseOrder());
    }

    private static int logoLocaleScore(String iso) {
        if (iso == null) return 1;                       // included, lowest priority
        int idx = LOGO_LOCALE_PRIORITY.indexOf(iso);
        return idx >= 0 ? (LOGO_LOCALE_PRIORITY.size() - idx) * 10 : 0;  // hi > en > gu
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