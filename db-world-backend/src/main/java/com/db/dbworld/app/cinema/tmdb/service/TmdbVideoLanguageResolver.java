package com.db.dbworld.app.cinema.tmdb.service;

import com.db.dbworld.app.cinema.tmdb.client.dto.TranslationTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.client.dto.TranslationsTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.client.dto.VideoTmdbResponse;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

/**
 * Works out which extra languages are worth asking TMDB about for trailers, and merges the
 * results.
 *
 * <p>Why this exists: TMDB serves videos for one language at a time. The detail endpoint filters
 * its {@code videos} append by {@code language} (default en-US), and — unlike images, which come
 * back in every language regardless — there is no {@code include_video_language} on the movie
 * endpoints. Verified against the live API: {@code ?append_to_response=videos} returns English
 * only, while {@code &language=hi-IN} returns only the Hindi videos. Collecting more than one
 * language therefore costs one extra request per language.
 *
 * <p>So rather than always paying for every supported locale, the {@code translations} append —
 * which is free, riding along on the detail call — tells us which languages TMDB actually holds
 * content for. Only those get a request.
 *
 * <p>Deliberately note what is NOT used as the signal: {@code spoken_languages} and
 * {@code origin_country}. A US production with English as its only spoken language can still have
 * an official Hindi trailer cut for the Indian market, so those fields would skip exactly the
 * case worth catching.
 */
public final class TmdbVideoLanguageResolver {

    /**
     * Locales we would show a trailer in, most preferred first. Mirrors the rail image locales.
     * {@code en} is excluded from extra requests because the unqualified detail call already
     * returns it.
     */
    private static final List<String> SUPPORTED_LANGUAGES = List.of("en", "hi", "gu");

    private static final String DEFAULT_LANGUAGE = "en";

    private TmdbVideoLanguageResolver() {
    }

    /**
     * Languages to make an extra {@code /videos} call for: supported, present in the title's
     * translations, and not the language the detail call already covered.
     *
     * <p>Returned in {@link #SUPPORTED_LANGUAGES} order so requests are issued most-preferred
     * first, and de-duplicated — TMDB lists a language once per country region ({@code pt} for
     * both PT and BR), but a video query takes a language, so one call covers all of them.
     */
    public static List<String> extraVideoLanguages(TranslationsTmdbResponse translations) {
        Set<String> available = availableLanguages(translations);

        List<String> candidates = new ArrayList<>();
        for (String language : SUPPORTED_LANGUAGES) {
            if (!DEFAULT_LANGUAGE.equals(language) && available.contains(language)) {
                candidates.add(language);
            }
        }
        return candidates;
    }

    /** Lower-cased set of languages TMDB holds a translation for; empty when the append is absent. */
    private static Set<String> availableLanguages(TranslationsTmdbResponse translations) {
        if (translations == null || translations.getTranslations() == null) {
            return Set.of();
        }
        return translations.getTranslations().stream()
                .filter(Objects::nonNull)
                .map(TranslationTmdbResponse::getIso_639_1)
                .filter(Objects::nonNull)
                .map(iso -> iso.trim().toLowerCase(Locale.ROOT))
                .filter(iso -> !iso.isEmpty())
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    /**
     * Merge extra-language videos into the ones already fetched, keeping the existing entries
     * first and skipping anything already present.
     *
     * <p>De-duplication is by TMDB's video id, which is also {@code VideoEntity}'s primary key —
     * so a duplicate reaching persistence would be an update rather than a second row. Filtering
     * here keeps the in-memory list honest regardless.
     */
    public static List<VideoTmdbResponse> merge(
            List<VideoTmdbResponse> existing,
            List<VideoTmdbResponse> additional) {

        List<VideoTmdbResponse> merged = new ArrayList<>();
        Set<String> seenIds = new LinkedHashSet<>();

        for (List<VideoTmdbResponse> source : List.of(
                existing == null ? List.<VideoTmdbResponse>of() : existing,
                additional == null ? List.<VideoTmdbResponse>of() : additional)) {

            for (VideoTmdbResponse video : source) {
                if (video == null) continue;
                // A video without an id can't be de-duplicated or persisted (id is the PK), so
                // it's dropped rather than risking a collision on insert.
                String id = video.getId();
                if (id == null || id.isBlank() || !seenIds.add(id)) continue;
                merged.add(video);
            }
        }
        return merged;
    }
}
