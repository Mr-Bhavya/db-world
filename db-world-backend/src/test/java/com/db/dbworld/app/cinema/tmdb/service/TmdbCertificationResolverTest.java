package com.db.dbworld.app.cinema.tmdb.service;

import com.db.dbworld.app.cinema.tmdb.client.dto.ContentRatingResultTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.client.dto.ContentRatingsTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.client.dto.ReleaseDateEntryTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.client.dto.ReleaseDateResultTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.client.dto.ReleaseDatesTmdbResponse;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers the country-preference and blank-handling rules for TMDB certifications.
 *
 * <p>The shapes here mirror real API responses, including the awkward parts: TMDB returns a
 * release entry whether or not that release was rated, so {@code certification} is very often
 * an empty string rather than absent, and a single country can hold several entries with only
 * one carrying a value.
 */
class TmdbCertificationResolverTest {

    private static ReleaseDateEntryTmdbResponse entry(String certification, Integer type) {
        ReleaseDateEntryTmdbResponse e = new ReleaseDateEntryTmdbResponse();
        e.setCertification(certification);
        e.setType(type);
        return e;
    }

    private static ReleaseDateResultTmdbResponse country(String iso, ReleaseDateEntryTmdbResponse... entries) {
        ReleaseDateResultTmdbResponse r = new ReleaseDateResultTmdbResponse();
        r.setIso_3166_1(iso);
        r.setRelease_dates(entries == null ? null : Arrays.asList(entries));
        return r;
    }

    private static ReleaseDatesTmdbResponse movie(ReleaseDateResultTmdbResponse... countries) {
        ReleaseDatesTmdbResponse d = new ReleaseDatesTmdbResponse();
        d.setResults(countries == null ? null : Arrays.asList(countries));
        return d;
    }

    private static ContentRatingResultTmdbResponse rating(String iso, String value) {
        ContentRatingResultTmdbResponse r = new ContentRatingResultTmdbResponse();
        r.setIso_3166_1(iso);
        r.setRating(value);
        return r;
    }

    private static ContentRatingsTmdbResponse tv(ContentRatingResultTmdbResponse... ratings) {
        ContentRatingsTmdbResponse c = new ContentRatingsTmdbResponse();
        c.setResults(ratings == null ? null : Arrays.asList(ratings));
        return c;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Movies — release_dates
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Movies {

        @Test
        void indianRatingWinsOverEveryOtherCountry() {
            var result = TmdbCertificationResolver.fromMovie(movie(
                    country("US", entry("PG-13", 3)),
                    country("GB", entry("12A", 3)),
                    country("IN", entry("UA", 3))));

            assertThat(result).isPresent();
            assertThat(result.get().value()).isEqualTo("UA");
            assertThat(result.get().country()).isEqualTo("IN");
        }

        @Test
        void americanRatingIsTheFallbackWhenIndiaHasNotRatedIt() {
            var result = TmdbCertificationResolver.fromMovie(movie(
                    country("GB", entry("15", 3)),
                    country("US", entry("R", 3))));

            assertThat(result).isPresent();
            assertThat(result.get().value()).isEqualTo("R");
            assertThat(result.get().country()).isEqualTo("US");
        }

        @Test
        void anyRatingCountryIsUsedWhenNeitherPreferredOneHasOne() {
            var result = TmdbCertificationResolver.fromMovie(movie(
                    country("FR", entry("Tous publics", 3))));

            assertThat(result).isPresent();
            assertThat(result.get().value()).isEqualTo("Tous publics");
            assertThat(result.get().country()).isEqualTo("FR");
        }

        @Test
        void aBlankCertificationIsSkippedInFavourOfARatedEntryForTheSameCountry() {
            // TMDB returns an entry per release, rated or not: premiere and digital often
            // carry "" while the theatrical release holds the actual certification.
            var result = TmdbCertificationResolver.fromMovie(movie(
                    country("IN", entry("", 1), entry("   ", 4), entry("A", 3))));

            assertThat(result).isPresent();
            assertThat(result.get().value()).isEqualTo("A");
        }

        @Test
        void aCountryWhoseEntriesAreAllBlankFallsThroughToTheNextCountry() {
            var result = TmdbCertificationResolver.fromMovie(movie(
                    country("IN", entry("", 1), entry(null, 4)),
                    country("US", entry("PG", 3))));

            assertThat(result).isPresent();
            assertThat(result.get().value()).isEqualTo("PG");
            assertThat(result.get().country()).isEqualTo("US");
        }

        @Test
        void countryCodeMatchingIsCaseInsensitiveAndNormalisedToUpperCase() {
            var result = TmdbCertificationResolver.fromMovie(movie(
                    country("in", entry("U", 3))));

            assertThat(result).isPresent();
            assertThat(result.get().country()).isEqualTo("IN");
        }

        @Test
        void certificationValuesAreTrimmed() {
            var result = TmdbCertificationResolver.fromMovie(movie(
                    country("IN", entry("  UA 13+  ", 3))));

            assertThat(result).isPresent();
            assertThat(result.get().value()).isEqualTo("UA 13+");
        }

        @Test
        void nothingRatedAnywhereYieldsEmpty() {
            var result = TmdbCertificationResolver.fromMovie(movie(
                    country("IN", entry("", 3)),
                    country("US", entry(null, 3))));

            assertThat(result).isEmpty();
        }

        @Test
        void aCountryWithNoReleaseEntriesAtAllIsSkipped() {
            var result = TmdbCertificationResolver.fromMovie(movie(
                    country("IN", (ReleaseDateEntryTmdbResponse[]) null),
                    country("US", entry("PG-13", 3))));

            assertThat(result).isPresent();
            assertThat(result.get().value()).isEqualTo("PG-13");
        }

        @Test
        void anAbsentAppendYieldsEmptyRatherThanThrowing() {
            // getMovie(...) doesn't request the append, so release_dates is null there.
            assertThat(TmdbCertificationResolver.fromMovie(null)).isEmpty();
            assertThat(TmdbCertificationResolver.fromMovie(new ReleaseDatesTmdbResponse())).isEmpty();
            assertThat(TmdbCertificationResolver.fromMovie(movie())).isEmpty();
        }

        @Test
        void nullEntriesInTheListDoNotBreakResolution() {
            ReleaseDatesTmdbResponse d = new ReleaseDatesTmdbResponse();
            d.setResults(Arrays.asList(null, country("IN", entry("UA", 3))));

            var result = TmdbCertificationResolver.fromMovie(d);

            assertThat(result).isPresent();
            assertThat(result.get().value()).isEqualTo("UA");
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Series — content_ratings
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Series {

        @Test
        void indianRatingWinsForSeriesToo() {
            var result = TmdbCertificationResolver.fromTvSeries(tv(
                    rating("US", "TV-14"),
                    rating("IN", "U/A 16+")));

            assertThat(result).isPresent();
            assertThat(result.get().value()).isEqualTo("U/A 16+");
            assertThat(result.get().country()).isEqualTo("IN");
        }

        @Test
        void americanRatingIsTheFallback() {
            var result = TmdbCertificationResolver.fromTvSeries(tv(
                    rating("DE", "16"),
                    rating("US", "TV-MA")));

            assertThat(result).isPresent();
            assertThat(result.get().value()).isEqualTo("TV-MA");
            assertThat(result.get().country()).isEqualTo("US");
        }

        @Test
        void blankRatingsAreTreatedAsAbsent() {
            var result = TmdbCertificationResolver.fromTvSeries(tv(
                    rating("IN", ""),
                    rating("US", "   "),
                    rating("AU", "MA15+")));

            assertThat(result).isPresent();
            assertThat(result.get().value()).isEqualTo("MA15+");
            assertThat(result.get().country()).isEqualTo("AU");
        }

        @Test
        void nothingRatedAnywhereYieldsEmpty() {
            assertThat(TmdbCertificationResolver.fromTvSeries(tv(rating("IN", "")))).isEmpty();
        }

        @Test
        void anAbsentAppendYieldsEmptyRatherThanThrowing() {
            assertThat(TmdbCertificationResolver.fromTvSeries(null)).isEmpty();
            assertThat(TmdbCertificationResolver.fromTvSeries(new ContentRatingsTmdbResponse())).isEmpty();
            assertThat(TmdbCertificationResolver.fromTvSeries(tv())).isEmpty();
        }

        @Test
        void ratingsAreTrimmedButInnerSpacingIsPreserved() {
            var result = TmdbCertificationResolver.fromTvSeries(tv(rating("IN", " U/A 13+ ")));

            assertThat(result).isPresent();
            assertThat(result.get().value()).isEqualTo("U/A 13+");
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Preference order is data, not incidental ordering
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void preferenceIsByCountryNotByPositionInTheResponse() {
        // US appears first in the payload; IN must still win.
        List<ReleaseDateResultTmdbResponse> ordered = List.of(
                country("US", entry("PG-13", 3)),
                country("IN", entry("UA", 3)));
        ReleaseDatesTmdbResponse d = new ReleaseDatesTmdbResponse();
        d.setResults(ordered);

        assertThat(TmdbCertificationResolver.fromMovie(d).orElseThrow().country()).isEqualTo("IN");
    }
}
