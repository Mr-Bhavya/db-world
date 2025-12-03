package com.db.dbworld.entities.dbcinema.tmdb;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.entities.dbcinema.tmdb.credits.CreditsEntity;
import com.db.dbworld.entities.dbcinema.tmdb.images.ImagesEntity;
import com.db.dbworld.entities.dbcinema.tmdb.providers.ProvidersEntity;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "TMDB_DATA", schema = "db_world")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "record_type", discriminatorType = DiscriminatorType.STRING)
public class TmdbDataEntity implements Serializable {
    @Id
    private long id;

    @JsonIgnore
    @OneToOne(mappedBy = "tmdb", cascade = CascadeType.ALL, orphanRemoval = true)
    private DBCinemaRecordsEntity dbCinemaRecordsEntity;

    private boolean adult;
    private String backdrop_path;

    @ManyToMany(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(name = "tmdb_genres_mapping", joinColumns = @JoinColumn(name = "tmdb_id"),
            inverseJoinColumns = @JoinColumn(name = "genres_id"))
    private List<GenresEntity> genres;

    private String homepage;
    private String original_language;
    private String original_title;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String overview;

    private double popularity;
    private String poster_path;

    @ManyToMany(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(name = "tmdb_production_companies_mapping", joinColumns = @JoinColumn(name = "tmdb_id"),
            inverseJoinColumns = @JoinColumn(name = "production_companies_id"))
    private List<ProductionCompaniesEntity> production_companies;

    @ManyToMany(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(name = "tmdb_countries_mapping", joinColumns = @JoinColumn(name = "tmdb_id"),
            inverseJoinColumns = @JoinColumn(name = "countries_id"))
    private List<ProductionCountriesEntity> production_countries;

    @ManyToMany(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST})
    @JoinTable(name = "tmdb_spoken_languages_mapping", joinColumns = @JoinColumn(name = "tmdb_id"),
            inverseJoinColumns = @JoinColumn(name = "spoken_languages_id"))
    private List<SpokenLanguageEntity> spoken_languages;
    private String status;
    private String tagline;
    private String title;
    private double vote_average;
    private int vote_count;

    @OneToMany(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "tmdb", referencedColumnName = "id")
    private List<VideosEntity> videos;

    @OneToMany(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "tmdb", referencedColumnName = "id")
    private List<ImagesEntity> images;

    @OneToOne(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "credits", referencedColumnName = "id")
    private CreditsEntity credits;

    @OneToOne(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "providers", referencedColumnName = "id")
    private ProvidersEntity providers;

}
