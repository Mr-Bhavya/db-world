package com.db.dbworld.app.cinema.tmdb.entities;

import com.db.dbworld.app.cinema.tmdb.people.entity.PersonEntity;
import com.db.dbworld.app.cinema.tmdb.season.entity.EpisodeEntity;
import com.db.dbworld.app.cinema.tmdb.season.entity.SeasonEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Entity
@DiscriminatorValue("TV_SERIES")
@Getter
@Setter
public class TvSeriesTmdbEntity extends TmdbEntity {

    private String firstAirDate;

    private String lastAirDate;

    /** Feeds the base {@code primaryDate} sort column with this series' first-air date. */
    @PrePersist
    @PreUpdate
    void syncPrimaryDate() {
        setPrimaryDate(blankToNull(firstAirDate));
    }

    private boolean inProduction;

    private int numberOfEpisodes;

    private int numberOfSeasons;

    private String type;

    @OneToMany(mappedBy = "tvShow", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SeasonEntity> seasons;

    @ElementCollection
    @CollectionTable(
            name = "tmdb_tv_episode_runtime",
            schema = "db_world",
            joinColumns = @JoinColumn(name = "tmdb_id")
    )
    @Column(name = "runtime")
    private List<Integer> episodeRunTimes;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_episode_id")
    private EpisodeEntity lastEpisodeToAir;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "next_episode_id")
    private EpisodeEntity nextEpisodeToAir;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "tmdb_tv_created_by",
            schema = "db_world",
            joinColumns = @JoinColumn(name = "tmdb_id"),
            inverseJoinColumns = @JoinColumn(name = "person_id")
    )
    private List<PersonEntity> createdBy;

}
