package com.db.dbworld.app.cinema.tmdb.search.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TmdbSearchItemDto {

    private Long id;

    private String title;           // movies

    private String name;            // TV series

    private String overview;

    @JsonProperty("poster_path")
    private String posterPath;

    @JsonProperty("release_date")
    private String releaseDate;     // movies

    @JsonProperty("first_air_date")
    private String firstAirDate;    // TV series

    @JsonProperty("vote_average")
    private double voteAverage;
}
