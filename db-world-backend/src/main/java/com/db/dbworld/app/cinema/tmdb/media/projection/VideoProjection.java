package com.db.dbworld.app.cinema.tmdb.media.projection;

import com.db.dbworld.app.cinema.tmdb.enums.VideoType;

public interface VideoProjection {

    Long getTmdbId();

    String getKey();

    VideoType getType();

}
