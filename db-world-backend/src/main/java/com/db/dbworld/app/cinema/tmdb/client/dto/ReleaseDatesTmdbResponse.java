package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * {@code /movie/{id}?append_to_response=release_dates} — per-country release dates, each
 * carrying the certification issued by that country's board. This is where a movie's
 * age rating lives; the flat {@code release_date} field is only the date.
 */
@Getter
@Setter
public class ReleaseDatesTmdbResponse {

    private List<ReleaseDateResultTmdbResponse> results;

}
