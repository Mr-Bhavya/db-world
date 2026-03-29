package com.db.dbworld.app.cinema.tmdb.media.dto;

import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.cinema.tmdb.enums.VideoSite;
import com.db.dbworld.app.cinema.tmdb.enums.VideoType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VideoDto {

    private String id;

    private String name;

    private String key;

    private VideoSite site;

    private int size;

    private VideoType type;

    private boolean official;

    private String publishedAt;

    private String iso6391;

    private String iso31661;

}