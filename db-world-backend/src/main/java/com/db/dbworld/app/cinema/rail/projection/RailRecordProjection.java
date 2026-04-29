package com.db.dbworld.app.cinema.rail.projection;

import com.db.dbworld.app.cinema.enums.RecordType;

import java.time.LocalDate;

public interface RailRecordProjection {

    Long getId();

    String getTitle();

    RecordType getType();

    String getPosterPath();

    String getBackdropPath();

    Double getVoteAverage();

    Double getPopularity();

    LocalDate getReleaseDate();

    String getOverview();

    Long getTmdbId();

    Integer getRuntime();

    Integer getNumberOfSeasons();
}
