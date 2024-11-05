package com.db.dbworld.entities.dbcinema.tmdb;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "SEASONS", schema = "db_world")
public class SeasonsEntity {

    @Id
    private int id;
    private String name;
    private String air_date;
    private int episode_count;
    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String overview;
    private String poster_path;
    private int season_number;
    private double vote_average;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tmdb", referencedColumnName = "id")
    private TmdbDataEntity tmdbDataEntity;
    

}
