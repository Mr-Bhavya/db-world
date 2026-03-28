package com.db.dbworld.app.cinema.rail.projection;

import com.db.dbworld.cinema.enums.RecordType;
import com.db.dbworld.cinema.tmdb.genre.entity.GenreEntity;

import java.time.LocalDate;
import java.util.List;

public interface RailRecordProjection {

    Long getId();

    String getTitle();

    RecordType getType();

    List<GenreEntity> getGenres();

    String getPosterPath();

    String getBackdropPath();

    Double getVoteAverage();

    Double getPopularity();

    LocalDate getReleaseDate();

    String getOverview();

    Long getTmdbId();
}
