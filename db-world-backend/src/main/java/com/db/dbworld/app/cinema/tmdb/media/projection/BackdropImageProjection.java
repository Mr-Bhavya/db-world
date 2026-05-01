package com.db.dbworld.app.cinema.tmdb.media.projection;

public interface BackdropImageProjection {

    Long getTmdbId();

    String getFilePath();

    String getIso6391();

    Integer getHeight();

}
