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
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.*;

@Service
@RequiredArgsConstructor
public class RailAggregationServiceImpl implements RailAggregationService {

    private final PosterImageRepository posterImageRepository;
    private final BackdropImageRepository backdropImageRepository;
    private final VideoRepository videoRepository;
    private final TmdbProviderRepository tmdbProviderRepository;
    private final GenreRepository genreRepository;
    private final TmdbProviderMapper providerMapper;

    private static final String REGION_CODE_IN = "IN";

    private static final Map<VideoType, Integer> VIDEO_PRIORITY = Map.of(
            VideoType.TRAILER, 3,
            VideoType.TEASER, 2,
            VideoType.CLIP, 1,
            VideoType.FEATURETTE, 0,
            VideoType.BEHIND_THE_SCENES, 0
    );

    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    /* =========================================================
       MAIN ENTRY
    ========================================================= */

    @Override
    public RailAggregationResult aggregate(List<Long> tmdbIds) {

        if (tmdbIds == null || tmdbIds.isEmpty()) {
            return RailAggregationResult.empty();
        }

        CompletableFuture<Map<Long, List<String>>> genreFuture =
                CompletableFuture.supplyAsync(() -> fetchGenres(tmdbIds), executor);

        CompletableFuture<Map<Long, List<PosterImageProjection>>> posterFuture =
                CompletableFuture.supplyAsync(() -> fetchPosters(tmdbIds), executor);

        CompletableFuture<Map<Long, List<BackdropImageProjection>>> backdropFuture =
                CompletableFuture.supplyAsync(() -> fetchBackdrops(tmdbIds), executor);

        CompletableFuture<Map<Long, List<VideoProjection>>> videoFuture =
                CompletableFuture.supplyAsync(() -> fetchVideos(tmdbIds), executor);

        CompletableFuture<Map<Long, List<TmdbProviderDto>>> providerFuture =
                CompletableFuture.supplyAsync(() -> fetchProviders(tmdbIds), executor);

        CompletableFuture.allOf(
                genreFuture,
                posterFuture,
                backdropFuture,
                videoFuture,
                providerFuture
        ).join();

        return new RailAggregationResult(
                genreFuture.getNow(Collections.emptyMap()),
                posterFuture.getNow(Collections.emptyMap()),
                backdropFuture.getNow(Collections.emptyMap()),
                videoFuture.getNow(Collections.emptyMap()),
                providerFuture.getNow(Collections.emptyMap())
        );
    }

    /* =========================================================
       FETCH METHODS (MOVED FROM RailService)
    ========================================================= */

    private Map<Long, List<String>> fetchGenres(List<Long> tmdbIds) {

        List<TmdbGenreProjection> projections =
                genreRepository.findGenresByTmdbIds(tmdbIds);

        Map<Long, List<String>> map = new HashMap<>(tmdbIds.size());

        for (TmdbGenreProjection g : projections) {
            if (g.getTmdbId() != null && g.getGenre() != null) {
                map.computeIfAbsent(g.getTmdbId(), k -> new ArrayList<>())
                        .add(g.getGenre().getName());
            }
        }

        return map;
    }

    private Map<Long, List<PosterImageProjection>> fetchPosters(List<Long> tmdbIds) {

        List<PosterImageProjection> posters =
                posterImageRepository.findPostersByTmdbIds(tmdbIds);

        posters.sort((a, b) -> {
            Integer h1 = a.getHeight();
            Integer h2 = b.getHeight();
            if (h1 == null && h2 == null) return 0;
            if (h1 == null) return 1;
            if (h2 == null) return -1;
            return h2.compareTo(h1);
        });

        Map<Long, List<PosterImageProjection>> map = new HashMap<>(tmdbIds.size());

        for (PosterImageProjection p : posters) {
            if (p.getTmdbId() != null) {
                map.computeIfAbsent(p.getTmdbId(), k -> new ArrayList<>()).add(p);
            }
        }

        return map;
    }

    private Map<Long, List<BackdropImageProjection>> fetchBackdrops(List<Long> tmdbIds) {

        List<BackdropImageProjection> backdrops =
                backdropImageRepository.findBackdropsByTmdbIds(tmdbIds);

        backdrops.sort((a, b) -> {
            Integer h1 = a.getHeight();
            Integer h2 = b.getHeight();
            if (h1 == null && h2 == null) return 0;
            if (h1 == null) return 1;
            if (h2 == null) return -1;
            return h2.compareTo(h1);
        });

        Map<Long, List<BackdropImageProjection>> map = new HashMap<>(tmdbIds.size());

        for (BackdropImageProjection b : backdrops) {
            if (b.getTmdbId() != null) {
                map.computeIfAbsent(b.getTmdbId(), k -> new ArrayList<>()).add(b);
            }
        }

        return map;
    }

    private Map<Long, List<VideoProjection>> fetchVideos(List<Long> tmdbIds) {

        List<VideoProjection> videos =
                videoRepository.findVideos(tmdbIds, VideoSite.YOUTUBE);

        Map<Long, List<VideoProjection>> map = new HashMap<>(tmdbIds.size());

        for (VideoProjection v : videos) {
            if (v.getTmdbId() != null && v.getKey() != null) {
                map.computeIfAbsent(v.getTmdbId(), k -> new ArrayList<>()).add(v);
            }
        }

        for (List<VideoProjection> list : map.values()) {
            list.sort((a, b) -> Integer.compare(
                    VIDEO_PRIORITY.getOrDefault(b.getType(), 0),
                    VIDEO_PRIORITY.getOrDefault(a.getType(), 0)
            ));
        }

        return map;
    }

    private Map<Long, List<TmdbProviderDto>> fetchProviders(List<Long> tmdbIds) {

        List<ProviderProjection> providers =
                tmdbProviderRepository.findProvidersByTmdbIdIn(tmdbIds, REGION_CODE_IN);

        Map<Long, List<TmdbProviderDto>> map = new HashMap<>(tmdbIds.size());

        for (ProviderProjection p : providers) {
            if (p.getTmdbId() != null) {
                map.computeIfAbsent(p.getTmdbId(), k -> new ArrayList<>())
                        .add(providerMapper.fromProjection(p));
            }
        }

        return map;
    }
}