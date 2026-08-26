package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

/**
 * The translated fields. Empty strings are the norm rather than the exception: the primary
 * language's entry carries {@code title: ""} because the flat payload already holds it, and
 * whole entries can be blank throughout (Zhuang, for instance).
 *
 * <p>{@code runtime} is deliberately exposed but must not be treated as authoritative — it
 * varies per translation because regional cuts differ, and is 0 on unfilled entries. Runtime
 * belongs to the flat payload.
 */
@Getter
@Setter
public class TranslationDataTmdbResponse {

    private String title;

    private String overview;

    private String tagline;

    private String homepage;

    private Integer runtime;

}
