package com.db.dbworld.app.cinema.tmdb.client.dto;

import com.db.dbworld.app.cinema.tmdb.collection.dto.CollectionDto;
import com.db.dbworld.app.cinema.tmdb.dto.TmdbDto;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MovieTmdbResponse extends TmdbResponse {

    private String title;

    private String original_title;

    private Long id;

    private long budget;

    private String imdb_id;

    private String release_date;

    private long revenue;

    private Integer runtime;

    private boolean video;

    private CollectionTmdbResponse belongs_to_collection;

}