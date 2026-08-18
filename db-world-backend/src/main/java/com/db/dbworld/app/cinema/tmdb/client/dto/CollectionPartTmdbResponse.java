package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CollectionPartTmdbResponse {

    private Long id;

    private String title;

    private String overview;

    private String poster_path;

    private String backdrop_path;

    private String release_date;

    private Double vote_average;

}
