package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * {@code /tv/{id}?append_to_response=content_ratings} — the TV equivalent of a movie's
 * release_dates certifications. Flatter: one rating per country, no release entries.
 */
@Getter
@Setter
public class ContentRatingsTmdbResponse {

    private List<ContentRatingResultTmdbResponse> results;

}
