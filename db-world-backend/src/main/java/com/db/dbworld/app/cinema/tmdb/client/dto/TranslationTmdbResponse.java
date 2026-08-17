package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

/**
 * One language's translation. Note {@code iso_639_1} is not unique across the list —
 * {@code pt} appears for both PT and BR, {@code es} for ES and MX, {@code zh} for CN/TW/HK —
 * with genuinely different text, so language alone does not identify an entry.
 */
@Getter
@Setter
public class TranslationTmdbResponse {

    private String iso_639_1;

    private String iso_3166_1;

    private String name;

    private String english_name;

    private TranslationDataTmdbResponse data;

}
