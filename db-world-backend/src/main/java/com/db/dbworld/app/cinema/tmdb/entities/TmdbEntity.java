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
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
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
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class TmdbEntity {

    /** Min vote count for the Bayesian weighted rating — damps low-vote outliers. */
    private static final double WEIGHTED_RATING_MIN_VOTES = 50.0;
    /** Prior mean rating pulled toward when a title has few votes. */
    private static final double WEIGHTED_RATING_PRIOR_MEAN = 6.5;

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

    /* ── Derived sort fields (kept in sync by lifecycle hooks; used by rail sorting) ──
       These exist so rails can sort uniformly across movies AND series:
       - primaryDate: release date for movies / first-air date for series (set by the
         subclass hooks) so a mixed Home rail can sort by date.
       - weightedRating: Bayesian "Top rated" score so a 10/10 with 3 votes doesn't beat
         an 8.5 with thousands of votes.
       - updatedAt: bumps via auditing whenever TMDB data for this title changes (manual
         refresh or batch sync). Distinct from records.updated_at (catalog edits). */

    @Column(name = "primary_date")
    private String primaryDate;

    @Column(name = "weighted_rating")
    private Double weightedRating;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    /** Recomputes the weighted rating on every persist/update from base vote fields. */
    @PrePersist
    @PreUpdate
    void computeWeightedRating() {
        double v = voteCount;
        this.weightedRating =
                (v / (v + WEIGHTED_RATING_MIN_VOTES)) * voteAverage
                        + (WEIGHTED_RATING_MIN_VOTES / (v + WEIGHTED_RATING_MIN_VOTES)) * WEIGHTED_RATING_PRIOR_MEAN;
    }

    /** Normalises blank/whitespace date strings to null so they sort last (DESC). */
    protected static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

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
