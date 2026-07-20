package com.db.dbworld.app.cinema.tmdb.media.projection;

public interface PosterImageProjection {

    Long getTmdbId();

    String getFilePath();

    String getIso6391();

    Integer getHeight();

    Double getVoteAverage();

    Integer getVoteCount();

}
