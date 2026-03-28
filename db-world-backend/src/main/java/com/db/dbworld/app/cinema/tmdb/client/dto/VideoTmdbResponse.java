package com.db.dbworld.app.cinema.tmdb.client.dto;

import com.db.dbworld.cinema.tmdb.enums.VideoSite;
import com.db.dbworld.cinema.tmdb.enums.VideoType;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VideoTmdbResponse {

    private String id;

    private String name;

    private String key;

    private VideoSite site;

    private int size;

    private VideoType type;

    private boolean official;

    private String published_at;

    private String iso_639_1;

    private String iso_3166_1;

}