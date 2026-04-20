package com.db.dbworld.app.cinema.tmdb.season.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "tmdb_episodes", schema = "new_db_world")
public class EpisodeEntity {

    @Id
    private Long id;

    private int episodeNumber;

    private String name;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String overview;

    private String airDate;

    private int runtime;

    private double voteAverage;

    private int voteCount;

    private String stillPath;

    private Integer seasonNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "season_id")
    private SeasonEntity season;

}