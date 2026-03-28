package com.db.dbworld.app.cinema.tmdb.genre.dto;

import com.db.dbworld.cinema.tmdb.genre.entity.GenreEntity;

public interface TmdbGenreProjection {

    Long getTmdbId();

    GenreEntity getGenre();

}
