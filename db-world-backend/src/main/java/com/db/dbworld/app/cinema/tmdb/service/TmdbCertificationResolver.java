package com.db.dbworld.app.cinema.tmdb.service;

import com.db.dbworld.app.cinema.tmdb.client.dto.ContentRatingResultTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.client.dto.ContentRatingsTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.client.dto.ReleaseDateEntryTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.client.dto.ReleaseDateResultTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.client.dto.ReleaseDatesTmdbResponse;

import java.util.List;
import java.util.Optional;

/**
 * Picks the age rating to display from TMDB's per-country certification data.
 *
 * <p>Movies and TV carry this in different shapes — a movie's sits on individual release
 * entries under {@code release_dates}, a series' is one flat rating per country under
 * {@code content_ratings} — but the choice is the same either way: prefer the Indian
 * board's rating, fall back to the US one, and otherwise take whatever country actually
 * rated it. Deliberately pure and free of Spring so the selection can be tested directly
 * against real response shapes.
 */
public final class TmdbCertificationResolver {

    /**
     * Country preference. IN first because that's the audience; US second because it is
     * by far the best-populated country on TMDB when IN is missing.
     */
    private static final List<String> PREFERRED_COUNTRIES = List.of("IN", "US");

    private TmdbCertificationResolver() {
    }

    /** A resolved rating together with the country whose board issued it. */
    public record Certification(String value, String country) {
    }

    /**
     * Resolve a movie certification from {@code release_dates}.
     *
     * <p>Within a country the entries are scanned in TMDB's own order and the first
     * non-blank certification wins. Blank is the common case, not an anomaly: TMDB returns
     * a release entry whether or not that particular release was rated, so a country can
     * hold several entries with only one carrying a value.
     */
    public static Optional<Certification> fromMovie(ReleaseDatesTmdbResponse releaseDates) {
        if (releaseDates == null || releaseDates.getResults() == null) {
            return Optional.empty();
        }

        return pickCountry(
                releaseDates.getResults(),
                ReleaseDateResultTmdbResponse::getIso_3166_1,
                TmdbCertificationResolver::firstNonBlankCertification);
    }

    /** Resolve a series certification from {@code content_ratings}. */
    public static Optional<Certification> fromTvSeries(ContentRatingsTmdbResponse contentRatings) {
        if (contentRatings == null || contentRatings.getResults() == null) {
            return Optional.empty();
        }

        return pickCountry(
                contentRatings.getResults(),
                ContentRatingResultTmdbResponse::getIso_3166_1,
                result -> normalise(result.getRating()));
    }

    /**
     * Walk the preferred countries in order, then anything else, returning the first
     * country that yields a usable rating.
     */
    private static <T> Optional<Certification> pickCountry(
            List<T> results,
            java.util.function.Function<T, String> countryOf,
            java.util.function.Function<T, String> ratingOf) {

        for (String preferred : PREFERRED_COUNTRIES) {
            Optional<Certification> hit = results.stream()
                    .filter(r -> r != null && preferred.equalsIgnoreCase(countryOf.apply(r)))
                    .map(r -> toCertification(ratingOf.apply(r), countryOf.apply(r)))
                    .flatMap(Optional::stream)
                    .findFirst();
            if (hit.isPresent()) {
                return hit;
            }
        }

        // No preferred country rated it — surface whichever board did, so the UI shows a
        // real rating (labelled with its country) instead of nothing.
        return results.stream()
                .filter(r -> r != null && notBlank(countryOf.apply(r)))
                .map(r -> toCertification(ratingOf.apply(r), countryOf.apply(r)))
                .flatMap(Optional::stream)
                .findFirst();
    }

    private static Optional<Certification> toCertification(String rating, String country) {
        String value = normalise(rating);
        return value == null
                ? Optional.empty()
                : Optional.of(new Certification(value, country.trim().toUpperCase()));
    }

    private static String firstNonBlankCertification(ReleaseDateResultTmdbResponse result) {
        if (result.getRelease_dates() == null) {
            return null;
        }
        return result.getRelease_dates().stream()
                .filter(java.util.Objects::nonNull)
                .map(ReleaseDateEntryTmdbResponse::getCertification)
                .map(TmdbCertificationResolver::normalise)
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    /** Trims and collapses TMDB's blank-string-means-absent convention to null. */
    private static String normalise(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static boolean notBlank(String raw) {
        return normalise(raw) != null;
    }
}
