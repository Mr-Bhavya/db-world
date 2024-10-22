package com.db.dbworld.entities.dbcinema.tmdb;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "VIDEOS", schema = "db_world")
public class VideosEntity {
    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "iso_3166_1", referencedColumnName = "iso_3166_1")
    private ProductionCountriesEntity iso_3166_1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "iso_639_1", referencedColumnName = "iso_639_1")
    private SpokenLanguageEntity iso_639_1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tmdb", referencedColumnName = "id")
    private TmdbDataEntity tmdbDataEntity;

    private String name;

    @Column(name = "stream_key")
    private String key;
    private String site;
    private long size;
    private String type;
    private boolean official;
    private String published_at;
}
