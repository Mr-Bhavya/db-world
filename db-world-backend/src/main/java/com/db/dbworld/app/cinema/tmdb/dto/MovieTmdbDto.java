package com.db.dbworld.app.cinema.tmdb.dto;

import com.db.dbworld.app.cinema.tmdb.collection.dto.CollectionDto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MovieTmdbDto extends TmdbDto {

    private long budget;

    private String imdbId;

    private String releaseDate;

    private long revenue;

    private Integer runtime;

    private boolean video;

    private CollectionDto belongsToCollection;

}