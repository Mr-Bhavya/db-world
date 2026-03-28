package com.db.dbworld.app.cinema.tmdb.client.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CollectionTmdbResponse {

    private Long id;

    private String name;

    private String poster_path;

    private String backdrop_path;

}