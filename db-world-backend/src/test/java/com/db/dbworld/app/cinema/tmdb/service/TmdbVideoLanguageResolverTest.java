package com.db.dbworld.app.cinema.tmdb.service;

import com.db.dbworld.app.cinema.tmdb.client.dto.TranslationTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.client.dto.TranslationsTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.client.dto.VideoTmdbResponse;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers which extra languages get a videos request, and how the results merge.
 *
 * <p>Each extra language is a real HTTP request, so the point of the candidate logic is to make
 * as few as possible without missing a trailer that exists — these tests pin both halves of
 * that trade.
 */
class TmdbVideoLanguageResolverTest {

    private static TranslationTmdbResponse translation(String language, String country) {
        TranslationTmdbResponse t = new TranslationTmdbResponse();
        t.setIso_639_1(language);
        t.setIso_3166_1(country);
        return t;
    }

    private static TranslationsTmdbResponse translations(TranslationTmdbResponse... entries) {
        TranslationsTmdbResponse t = new TranslationsTmdbResponse();
        t.setTranslations(entries == null ? null : Arrays.asList(entries));
        return t;
    }

    private static VideoTmdbResponse video(String id, String language) {
        VideoTmdbResponse v = new VideoTmdbResponse();
        v.setId(id);
        v.setIso_639_1(language);
        return v;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Which languages to request
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Candidates {

        @Test
        void requestsHindiWhenTmdbHasAHindiTranslation() {
            var languages = TmdbVideoLanguageResolver.extraVideoLanguages(
                    translations(translation("en", "US"), translation("hi", "IN")));

            assertThat(languages).containsExactly("hi");
        }

        @Test
        void englishIsNeverRequestedBecauseTheDetailCallAlreadyReturnedIt() {
            var languages = TmdbVideoLanguageResolver.extraVideoLanguages(
                    translations(translation("en", "US")));

            assertThat(languages).isEmpty();
        }

        @Test
        void unsupportedLanguagesAreNotRequestedEvenWhenPresent() {
            // The title has plenty of translations, but we'd never show a German trailer.
            var languages = TmdbVideoLanguageResolver.extraVideoLanguages(
                    translations(translation("de", "DE"), translation("fr", "FR"),
                            translation("ru", "RU"), translation("ja", "JP")));

            assertThat(languages).isEmpty();
        }

        @Test
        void candidatesComeBackInPreferenceOrderNotPayloadOrder() {
            // gu appears before hi in the payload; hi is the higher preference.
            var languages = TmdbVideoLanguageResolver.extraVideoLanguages(
                    translations(translation("gu", "IN"), translation("de", "DE"),
                            translation("hi", "IN")));

            assertThat(languages).containsExactly("hi", "gu");
        }

        @Test
        void aLanguageListedForSeveralRegionsIsRequestedOnce() {
            // TMDB lists a language once per region (pt for PT and BR); a videos query takes a
            // language, so one request covers them all.
            var languages = TmdbVideoLanguageResolver.extraVideoLanguages(
                    translations(translation("hi", "IN"), translation("hi", "FJ")));

            assertThat(languages).containsExactly("hi");
        }

        @Test
        void languageCodesAreMatchedCaseInsensitively() {
            var languages = TmdbVideoLanguageResolver.extraVideoLanguages(
                    translations(translation("HI", "IN")));

            assertThat(languages).containsExactly("hi");
        }

        @Test
        void noTranslationsMeansNoExtraRequests() {
            // The whole point of the heuristic: a title with nothing Indian costs nothing.
            assertThat(TmdbVideoLanguageResolver.extraVideoLanguages(null)).isEmpty();
            assertThat(TmdbVideoLanguageResolver.extraVideoLanguages(new TranslationsTmdbResponse())).isEmpty();
            assertThat(TmdbVideoLanguageResolver.extraVideoLanguages(translations())).isEmpty();
        }

        @Test
        void blankAndNullLanguageCodesAreIgnored() {
            var languages = TmdbVideoLanguageResolver.extraVideoLanguages(
                    translations(translation(null, "ZA"), translation("  ", "XX"),
                            translation("hi", "IN")));

            assertThat(languages).containsExactly("hi");
        }

        @Test
        void nullEntriesInTheListDoNotBreakResolution() {
            TranslationsTmdbResponse t = new TranslationsTmdbResponse();
            t.setTranslations(Arrays.asList(null, translation("hi", "IN")));

            assertThat(TmdbVideoLanguageResolver.extraVideoLanguages(t)).containsExactly("hi");
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Merging the results
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Merge {

        @Test
        void existingVideosKeepTheirPlaceAndExtrasAreAppended() {
            var merged = TmdbVideoLanguageResolver.merge(
                    List.of(video("en1", "en")),
                    List.of(video("hi1", "hi"), video("hi2", "hi")));

            assertThat(merged).extracting(VideoTmdbResponse::getId)
                    .containsExactly("en1", "hi1", "hi2");
        }

        @Test
        void aVideoAlreadyPresentIsNotAddedTwice() {
            // Language queries shouldn't overlap, but the video id is also the entity's primary
            // key, so a duplicate here would be a wasted upsert at best.
            var merged = TmdbVideoLanguageResolver.merge(
                    List.of(video("shared", "en")),
                    List.of(video("shared", "en"), video("hi1", "hi")));

            assertThat(merged).extracting(VideoTmdbResponse::getId).containsExactly("shared", "hi1");
        }

        @Test
        void duplicatesWithinTheExtrasAreCollapsed() {
            var merged = TmdbVideoLanguageResolver.merge(
                    List.of(),
                    List.of(video("hi1", "hi"), video("hi1", "hi")));

            assertThat(merged).hasSize(1);
        }

        @Test
        void videosWithoutAnIdAreDroppedBecauseTheIdIsThePrimaryKey() {
            var merged = TmdbVideoLanguageResolver.merge(
                    List.of(video(null, "en"), video("  ", "en")),
                    List.of(video("hi1", "hi")));

            assertThat(merged).extracting(VideoTmdbResponse::getId).containsExactly("hi1");
        }

        @Test
        void nullsAreTolerated() {
            assertThat(TmdbVideoLanguageResolver.merge(null, null)).isEmpty();
            assertThat(TmdbVideoLanguageResolver.merge(null, List.of(video("a", "hi"))))
                    .extracting(VideoTmdbResponse::getId).containsExactly("a");
            assertThat(TmdbVideoLanguageResolver.merge(List.of(video("a", "en")), null))
                    .extracting(VideoTmdbResponse::getId).containsExactly("a");

            List<VideoTmdbResponse> withNullEntry = new ArrayList<>();
            withNullEntry.add(null);
            withNullEntry.add(video("a", "en"));
            assertThat(TmdbVideoLanguageResolver.merge(withNullEntry, null)).hasSize(1);
        }

        @Test
        void noExtrasLeavesTheOriginalListUntouched() {
            var merged = TmdbVideoLanguageResolver.merge(
                    List.of(video("en1", "en"), video("en2", "en")), List.of());

            assertThat(merged).extracting(VideoTmdbResponse::getId).containsExactly("en1", "en2");
        }
    }
}
