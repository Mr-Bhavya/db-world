package com.db.dbworld.app.cinema.tmdb.season.entity;

import com.db.dbworld.app.cinema.tmdb.entities.TvSeriesTmdbEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "tmdb_seasons", schema = "new_db_world")
public class SeasonEntity {

    @Id
    private Long id;

    private int seasonNumber;

    private String name;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String overview;

    private String posterPath;

    private String airDate;

    private Integer episodeCount;

    private Double voteAverage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tmdb_id")
    private TvSeriesTmdbEntity tvShow;

    @OneToMany(mappedBy = "season", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<EpisodeEntity> episodes;

}
