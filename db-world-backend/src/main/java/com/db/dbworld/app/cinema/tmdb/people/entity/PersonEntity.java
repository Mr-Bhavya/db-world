package com.db.dbworld.app.cinema.tmdb.people.entity;

import com.db.dbworld.app.cinema.tmdb.credits.entity.CreditEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TvSeriesTmdbEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "tmdb_people", schema = "new_db_world",
    // Background people-sync scans for the small "not yet synced" subset repeatedly.
    indexes = @Index(name = "idx_people_synced", columnList = "person_synced"))
public class PersonEntity {

    @Id
    private Long id;

    private boolean adult;

    private Integer gender;

    private String knownForDepartment;

    private String name;

    private String originalName;

    private double popularity;

    private String profilePath;

    private String imdbId;

    private String homepage;

    @Column(length = 4000)
    private String biography;

    private LocalDate birthday;

    private LocalDate deathday;

    private String placeOfBirth;

    @Column(length = 2000)
    private String alsoKnownAs;

    @Column(nullable = false)
    private boolean personSynced = false;

    @OneToMany(mappedBy = "person", fetch = FetchType.LAZY)
    private List<CreditEntity> credits;

    // TV Series creators
    @ManyToMany(mappedBy = "createdBy", fetch = FetchType.LAZY)
    private List<TvSeriesTmdbEntity> createdTvSeries;

}