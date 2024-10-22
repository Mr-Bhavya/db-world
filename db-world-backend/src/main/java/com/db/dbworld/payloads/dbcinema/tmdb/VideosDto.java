package com.db.dbworld.payloads.dbcinema.tmdb;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VideosDto {

    private String id;

    private String iso_3166_1;

    private String iso_639_1;

    private TmdbDataDto tmdbDataDto;

    private String name;
    private String key;
    private String site;
    private long size;
    private String type;
    private boolean official;
    private String published_at;
}
