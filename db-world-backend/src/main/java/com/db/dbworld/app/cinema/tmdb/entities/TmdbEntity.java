package com.db.dbworld.app.cinema.tmdb.entities;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.tmdb.company.entity.ProductionCompanyEntity;
import com.db.dbworld.app.cinema.tmdb.country.entity.ProductionCountryEntity;
import com.db.dbworld.app.cinema.tmdb.credits.entity.CreditEntity;
import com.db.dbworld.app.cinema.tmdb.genre.entity.GenreEntity;
import com.db.dbworld.app.cinema.tmdb.language.entity.SpokenLanguageEntity;
import com.db.dbworld.app.cinema.tmdb.media.entity.ImageEntity;
import com.db.dbworld.app.cinema.tmdb.media.entity.VideoEntity;
import com.db.dbworld.app.cinema.tmdb.providers.entity.TmdbProviderEntity;
import com.db.dbworld.app.cinema.tmdb.review.entity.ReviewEntity;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static jakarta.persistence.CascadeType.MERGE;
import static jakarta.persistence.CascadeType.PERSIST;

@Entity
@Table(name = "tmdb_data", schema = "new_db_world")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "record_type")
@BatchSize(size = 50)
@Getter
@Setter
public class TmdbEntity {

    @Id
    private Long id;

    @JsonIgnore
    @OneToOne(mappedBy = "tmdb")
    private RecordEntity record;

    private boolean adult;

    private String backdropPath;

    private String homepage;

    private String originalLanguage;

    private String originalTitle;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String overview;

    private Double popularity;

    private String posterPath;

    private String status;

    @Column(length = 1024)
    private String tagline;

    private String title;

    private double voteAverage;

    private int voteCount;

    // Genres
    @ManyToMany(fetch = FetchType.LAZY, cascade = {PERSIST, MERGE})
    @JoinTable(
            name = "tmdb_genres",
            schema = "new_db_world",
            joinColumns = @JoinColumn(name = "tmdb_id"),
            inverseJoinColumns = @JoinColumn(name = "genre_id")
    )
    private List<GenreEntity> genres;

    // Production Companies
    @ManyToMany(fetch = FetchType.LAZY, cascade = {PERSIST, MERGE})
    @JoinTable(
            name = "tmdb_production_companies",
            schema = "new_db_world",
            joinColumns = @JoinColumn(name = "tmdb_id"),
            inverseJoinColumns = @JoinColumn(name = "company_id")
    )
    private List<ProductionCompanyEntity> productionCompanies;

    // Production Countries
    @ManyToMany(fetch = FetchType.LAZY, cascade = {PERSIST, MERGE})
    @JoinTable(
            name = "tmdb_production_countries",
            schema = "new_db_world",
            joinColumns = @JoinColumn(name = "tmdb_id"),
            inverseJoinColumns = @JoinColumn(name = "country_code")
    )
    private List<ProductionCountryEntity> productionCountries;

    // Spoken Languages (no cascade)
    @ManyToMany(fetch = FetchType.LAZY, cascade = {PERSIST})
    @JoinTable(
            name = "tmdb_spoken_languages",
            schema = "new_db_world",
            joinColumns = @JoinColumn(name = "tmdb_id"),
            inverseJoinColumns = @JoinColumn(name = "language_code")
    )
    private List<SpokenLanguageEntity> spokenLanguages;

    // Videos
    @OneToMany(mappedBy = "tmdb", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<VideoEntity> videos;

    // Images
    @OneToMany(mappedBy = "tmdb", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ImageEntity> images;

    // Credits
    @OneToMany(mappedBy = "tmdb", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CreditEntity> credits;

    // Providers
    @OneToMany(mappedBy = "tmdb", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<TmdbProviderEntity> providers = new HashSet<>();

    // Reviews
    @OneToMany(mappedBy = "tmdb", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ReviewEntity> reviews;

}
