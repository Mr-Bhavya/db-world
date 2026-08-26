package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * One country's release entries. A country can have several — premiere, theatrical,
 * digital, physical, TV — and only some of them carry a certification.
 */
@Getter
@Setter
public class ReleaseDateResultTmdbResponse {

    private String iso_3166_1;

    private List<ReleaseDateEntryTmdbResponse> release_dates;

}
