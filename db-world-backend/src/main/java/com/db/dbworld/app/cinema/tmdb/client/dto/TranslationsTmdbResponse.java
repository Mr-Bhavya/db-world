package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * {@code append_to_response=translations} — every language TMDB holds text for.
 *
 * <p>Currently used only as a cheap signal for which languages are worth asking about: the
 * detail endpoint returns videos for one language at a time, and there is no
 * {@code include_video_language} on the movie endpoints, so extra {@code /videos} calls are
 * the only way to collect trailers in other languages. This tells us which calls could pay off
 * without costing a request of its own.
 */
@Getter
@Setter
public class TranslationsTmdbResponse {

    private List<TranslationTmdbResponse> translations;

}
