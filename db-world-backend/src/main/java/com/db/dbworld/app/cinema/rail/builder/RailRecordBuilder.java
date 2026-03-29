package com.db.dbworld.app.cinema.rail.builder;

import com.db.dbworld.app.cinema.rail.dto.RailRecordDto;
import com.db.dbworld.app.cinema.rail.projection.RailRecordProjection;
import com.db.dbworld.app.cinema.tmdb.enums.VideoType;
import com.db.dbworld.app.cinema.tmdb.media.projection.*;
        import com.db.dbworld.app.cinema.tmdb.providers.dto.TmdbProviderDto;

import org.springframework.stereotype.Component;

import java.util.*;
        import java.util.function.Predicate;

@Component
public class RailRecordBuilder {

    private static final int MAX_GENRES = 3;
    private static final int HIGH_RESOLUTION_THRESHOLD = 1080;

    private static final String YOUTUBE_EMBED = "https://www.youtube.com/embed/%s?autoplay=1&mute=1";

    private static final Set<String> PREFERRED_LANGUAGES = Set.of("hi", "en");

    private static final List<String> EMPTY_GENRES = Collections.emptyList();
    private static final List<TmdbProviderDto> EMPTY_PROVIDERS = Collections.emptyList();

    /* =========================================================
       PREDICATES
    ========================================================= */

    private static final Predicate<PosterImageProjection> POSTER_HIGH =
            p -> p.getHeight() != null && p.getHeight() >= HIGH_RESOLUTION_THRESHOLD;

    private static final Predicate<BackdropImageProjection> BACKDROP_HIGH =
            b -> b.getHeight() != null && b.getHeight() >= HIGH_RESOLUTION_THRESHOLD;

    private static final Predicate<PosterImageProjection> POSTER_LANG =
            p -> {
                String lang = p.getIso6391();
                return lang != null && PREFERRED_LANGUAGES.contains(lang.toLowerCase());
            };

    private static final Predicate<BackdropImageProjection> BACKDROP_LANG =
            b -> {
                String lang = b.getIso6391();
                return lang != null && PREFERRED_LANGUAGES.contains(lang.toLowerCase());
            };

    private static final Predicate<PosterImageProjection> POSTER_NO_TEXT =
            p -> p.getIso6391() == null;

    private static final Predicate<BackdropImageProjection> BACKDROP_NO_TEXT =
            b -> b.getIso6391() == null;

    /* =========================================================
       MAIN BUILD METHOD
    ========================================================= */

    public RailRecordDto build(
            RailRecordProjection r,
            Map<Long, List<String>> genres,
            Map<Long, List<PosterImageProjection>> posters,
            Map<Long, List<BackdropImageProjection>> backdrops,
            Map<Long, List<VideoProjection>> videos,
            Map<Long, List<TmdbProviderDto>> providers
    ) {

        Long tmdbId = r.getTmdbId();

        if (tmdbId == null) return minimal(r);

        List<String> genreList = genres.get(tmdbId);
        List<PosterImageProjection> posterList = posters.get(tmdbId);
        List<BackdropImageProjection> backdropList = backdrops.get(tmdbId);
        List<VideoProjection> videoList = videos.get(tmdbId);
        List<TmdbProviderDto> providerList = providers.get(tmdbId);

        return RailRecordDto.builder()
                .id(r.getId())
                .title(r.getTitle())
                .type(r.getType())
                .genres(genreList != null ? limitGenres(genreList) : EMPTY_GENRES)
                .posterPath(selectPoster(posterList, r.getPosterPath()))
                .posterPathClean(selectPosterClean(posterList, r.getPosterPath()))
                .backdropPath(selectBackdropClean(backdropList, r.getBackdropPath()))
                .backdropPathText(selectBackdropText(backdropList, r.getBackdropPath()))
                .voteAverage(r.getVoteAverage())
                .popularity(r.getPopularity())
                .releaseDate(r.getReleaseDate())
                .overview(r.getOverview())
                .previewVideoUrl(selectVideo(videoList))
                .providers(providerList != null ? providerList : EMPTY_PROVIDERS)
                .build();
    }

    /* =========================================================
       MINIMAL FALLBACK
    ========================================================= */

    public RailRecordDto minimal(RailRecordProjection r) {
        return RailRecordDto.builder()
                .id(r.getId())
                .title(r.getTitle())
                .type(r.getType())
                .posterPath(r.getPosterPath())
                .posterPathClean(r.getPosterPath())
                .backdropPath(r.getBackdropPath())
                .backdropPathText(r.getBackdropPath())
                .voteAverage(r.getVoteAverage())
                .popularity(r.getPopularity())
                .releaseDate(r.getReleaseDate())
                .overview(r.getOverview())
                .genres(EMPTY_GENRES)
                .providers(EMPTY_PROVIDERS)
                .build();
    }

    /* =========================================================
       HELPERS
    ========================================================= */

    private List<String> limitGenres(List<String> genres) {
        return genres.size() <= MAX_GENRES
                ? genres
                : genres.subList(0, MAX_GENRES);
    }

    /* =========================================================
       IMAGE SELECTION
    ========================================================= */

    private String selectPoster(List<PosterImageProjection> posters, String fallback) {
        if (posters == null || posters.isEmpty()) return fallback;

        PosterImageProjection best = null;
        int bestScore = -1;

        for (PosterImageProjection p : posters) {
            int score = 0;
            if (POSTER_HIGH.test(p)) score += 2;
            if (POSTER_LANG.test(p)) score += 1;

            if (score > bestScore) {
                bestScore = score;
                best = p;
                if (score == 3) break;
            }
        }

        return best != null ? best.getFilePath() : fallback;
    }

    private String selectPosterClean(List<PosterImageProjection> posters, String fallback) {
        if (posters == null || posters.isEmpty()) return fallback;

        PosterImageProjection best = null;
        int bestScore = -1;

        for (PosterImageProjection p : posters) {
            int score = 0;
            if (POSTER_HIGH.test(p)) score += 2;
            if (POSTER_NO_TEXT.test(p)) score += 1;

            if (score > bestScore) {
                bestScore = score;
                best = p;
                if (score == 3) break;
            }
        }

        return best != null ? best.getFilePath() : posters.getFirst().getFilePath();
    }

    private String selectBackdropClean(List<BackdropImageProjection> backdrops, String fallback) {
        if (backdrops == null || backdrops.isEmpty()) return fallback;

        BackdropImageProjection best = null;
        int bestScore = -1;

        for (BackdropImageProjection b : backdrops) {
            int score = 0;
            if (BACKDROP_HIGH.test(b)) score += 2;
            if (BACKDROP_NO_TEXT.test(b)) score += 1;

            if (score > bestScore) {
                bestScore = score;
                best = b;
                if (score == 3) break;
            }
        }

        return best != null ? best.getFilePath() : backdrops.getFirst().getFilePath();
    }

    private String selectBackdropText(List<BackdropImageProjection> backdrops, String fallback) {
        if (backdrops == null || backdrops.isEmpty()) return fallback;

        BackdropImageProjection best = null;
        int bestScore = -1;

        for (BackdropImageProjection b : backdrops) {
            int score = 0;
            if (BACKDROP_HIGH.test(b)) score += 2;
            if (BACKDROP_LANG.test(b)) score += 1;

            if (score > bestScore) {
                bestScore = score;
                best = b;
                if (score == 3) break;
            }
        }

        return best != null ? best.getFilePath() : backdrops.getFirst().getFilePath();
    }

    /* =========================================================
       VIDEO
    ========================================================= */

    private String selectVideo(List<VideoProjection> videos) {
        if (videos == null || videos.isEmpty()) return null;

        VideoProjection best = videos.getFirst();
        return String.format(YOUTUBE_EMBED, best.getKey());
    }
}
