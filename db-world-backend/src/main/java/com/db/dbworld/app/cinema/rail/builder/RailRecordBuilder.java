package com.db.dbworld.app.cinema.rail.builder;

import com.db.dbworld.app.cinema.rail.dto.RailRecordDto;
import com.db.dbworld.app.cinema.rail.projection.RailRecordProjection;
import com.db.dbworld.app.cinema.tmdb.enums.VideoType;
import com.db.dbworld.app.cinema.tmdb.media.projection.*;
        import com.db.dbworld.app.cinema.tmdb.providers.dto.TmdbProviderDto;

import org.springframework.stereotype.Component;

import java.util.*;
        import java.util.function.Function;
        import java.util.function.Predicate;
        import java.util.function.ToDoubleFunction;

@Component
public class RailRecordBuilder {

    private static final int MAX_GENRES = 3;
    private static final int HIGH_RESOLUTION_THRESHOLD = 1080;

    /** Hours per image-rotation window — how often a title's chosen image refreshes. */
    private static final int ROTATE_HOURS = 3;

    /** Rotate among the top-N best-voted images (variety without showing promo/alt art). */
    private static final int VARIANT_TOP_N = 5;

    private static final String YOUTUBE_EMBED = "https://www.youtube.com/embed/%s?autoplay=1&mute=1";

    private static final Set<String> PREFERRED_LANGUAGES = Set.of("en", "hi", "gu");

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

    // Community-vote score — ranks canonical artwork above low-vote promo/alt art.
    private static final ToDoubleFunction<PosterImageProjection> POSTER_VOTE =
            p -> voteScore(p.getVoteCount(), p.getVoteAverage());

    private static final ToDoubleFunction<BackdropImageProjection> BACKDROP_VOTE =
            b -> voteScore(b.getVoteCount(), b.getVoteAverage());

    /* =========================================================
       MAIN BUILD METHOD
    ========================================================= */

    public RailRecordDto build(
            RailRecordProjection r,
            Map<Long, List<String>> genres,
            Map<Long, List<PosterImageProjection>> posters,
            Map<Long, List<BackdropImageProjection>> backdrops,
            Map<Long, List<VideoProjection>> videos,
            Map<Long, List<TmdbProviderDto>> providers,
            Map<Long, List<LogoImageProjection>> logos
    ) {

        Long tmdbId = r.getTmdbId();

        if (tmdbId == null) return minimal(r);

        List<String> genreList = genres.get(tmdbId);
        List<PosterImageProjection> posterList = posters.get(tmdbId);
        List<BackdropImageProjection> backdropList = backdrops.get(tmdbId);
        List<VideoProjection> videoList = videos.get(tmdbId);
        List<TmdbProviderDto> providerList = providers.get(tmdbId);
        List<LogoImageProjection> logoList = logos.get(tmdbId);

        return RailRecordDto.builder()
                .id(r.getId())
                .title(r.getTitle())
                .type(r.getType())
                .genres(genreList != null ? limitGenres(genreList) : EMPTY_GENRES)
                // with-text → en/hi/gu; clean → no-text (iso null). Variant is a
                // hard requirement so these fields never cross over. tmdbId seeds
                // a time-windowed rotation so the picked image refreshes over time.
                .posterPath(selectVariant(posterList, tmdbId, POSTER_LANG, POSTER_HIGH, POSTER_VOTE, PosterImageProjection::getFilePath, r.getPosterPath()))
                .posterPathClean(selectVariant(posterList, tmdbId, POSTER_NO_TEXT, POSTER_HIGH, POSTER_VOTE, PosterImageProjection::getFilePath, r.getPosterPath()))
                .backdropPath(selectVariant(backdropList, tmdbId, BACKDROP_NO_TEXT, BACKDROP_HIGH, BACKDROP_VOTE, BackdropImageProjection::getFilePath, r.getBackdropPath()))
                // No text backdrop → null, so the card overlays its own title onto the clean backdrop.
                .backdropPathText(selectVariant(backdropList, tmdbId, BACKDROP_LANG, BACKDROP_HIGH, BACKDROP_VOTE, BackdropImageProjection::getFilePath, null))
                // Title logo (locale-best: hi > en > gu); null → UI uses text title.
                .logoPath(selectLogo(logoList))
                .voteAverage(r.getVoteAverage())
                .popularity(r.getPopularity())
                .releaseDate(r.getReleaseDate())
                .overview(r.getOverview())
                .runtime(r.getRuntime())
                .numberOfSeasons(r.getNumberOfSeasons())
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
                // null → no baked-in title, so a with-text rail overlays the title itself
                .backdropPathText(null)
                .voteAverage(r.getVoteAverage())
                .popularity(r.getPopularity())
                .releaseDate(r.getReleaseDate())
                .overview(r.getOverview())
                .runtime(r.getRuntime())
                .numberOfSeasons(r.getNumberOfSeasons())
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
                : new ArrayList<>(genres.subList(0, MAX_GENRES));
    }

    /* =========================================================
       IMAGE SELECTION
    ========================================================= */

    /**
     * Picks an image of a REQUIRED variant (with-text or no-text), rotating the
     * choice over time so the rail looks fresh instead of always showing the same
     * frame.
     *
     * The variant is a hard requirement, not a soft preference — a low-res
     * correct-variant image is chosen over a high-res wrong-variant one, so the
     * "clean" and "with-text" fields never cross over. Among matching images the
     * high-resolution ones form the candidate pool (falling back to any-resolution
     * matches). The pool is then ranked by community votes so the canonical
     * artwork wins and low-vote promo/alternate art (release dates, "Only on
     * Netflix", "Season 2"…) sinks; {@link #rotateIndex} rotates among the
     * top {@link #VARIANT_TOP_N} every {@link #ROTATE_HOURS} so it still varies.
     * When nothing matches the variant, {@code fallback} is returned — the
     * record's own path for the default fields, or {@code null} for the with-text
     * backdrop so the card overlays the title onto the clean image.
     */
    private static <T> String selectVariant(
            List<T> images,
            long seed,
            Predicate<T> variant,
            Predicate<T> highRes,
            ToDoubleFunction<T> voteFn,
            Function<T, String> pathFn,
            String fallback) {

        if (images == null || images.isEmpty()) return fallback;

        List<T> highPool = new ArrayList<>();
        List<T> allPool = new ArrayList<>();
        for (T img : images) {
            if (!variant.test(img)) continue;
            allPool.add(img);
            if (highRes.test(img)) highPool.add(img);
        }

        List<T> pool = highPool.isEmpty() ? allPool : highPool;
        if (pool.isEmpty()) return fallback;

        pool.sort(Comparator.comparingDouble(voteFn).reversed());
        int n = Math.min(VARIANT_TOP_N, pool.size());
        return pathFn.apply(pool.get(rotateIndex(seed, n)));
    }

    /** Vote score: vote count dominates (validation), average breaks ties. */
    private static double voteScore(Integer count, Double avg) {
        return (count != null ? count : 0) + (avg != null ? avg : 0.0) / 100.0;
    }

    /**
     * Deterministic index into the candidate pool that advances every
     * {@link #ROTATE_HOURS}. Stable within a window (so it's server-cache / CDN
     * friendly and doesn't flicker mid-session) but refreshes over time; the seed
     * (tmdbId) keeps different titles rotating out of phase. Wall-clock based, so
     * it survives restarts.
     */
    private static int rotateIndex(long seed, int size) {
        if (size <= 1) return 0;
        long window = System.currentTimeMillis() / (1000L * 60 * 60 * ROTATE_HOURS);
        return (int) (((seed * 31 + window) % size + size) % size);
    }

    /**
     * Best title logo — the aggregation already locale-ranks the list (en > hi >
     * gu > none), so the first entry is the preferred logo. Null → no logo, UI
     * falls back to the text title.
     */
    private static String selectLogo(List<LogoImageProjection> logos) {
        return (logos == null || logos.isEmpty()) ? null : logos.getFirst().getFilePath();
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
