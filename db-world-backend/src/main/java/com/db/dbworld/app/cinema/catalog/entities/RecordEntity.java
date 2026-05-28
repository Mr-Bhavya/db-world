package com.db.dbworld.app.cinema.catalog.entities;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.FilterDef;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.io.Serializable;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
@FilterDef(name = "excludeHidden")
@Filter(name = "excludeHidden", condition = "hide_from_rails = false")
@Table(
        name = "records",
        schema = "new_db_world"
)
public class RecordEntity implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 300)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RecordType type;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    /**
     * Direct access to TMDB ID without loading relation.
     * Useful for frontend responses and filtering.
     */
    @Column(name = "tmdb_id", insertable = false, updatable = false)
    private Long tmdbId;

    /**
     * TMDB media reference.
     *
     * IMPORTANT:
     * No cascade is used because TMDB entities are managed
     * by the TMDB ingestion service lifecycle.
     *
     * RecordEntity should NEVER delete TMDB metadata.
     */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tmdb_id", unique = true)
    private TmdbEntity tmdb;

    /**
     * Catalog tags like:
     * Trending, Top10, Featured etc.
     */
    @OneToMany(
            mappedBy = "record",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @Builder.Default
    private List<RecordTagEntity> tags = new ArrayList<>();

    /**
     * Hide this record from rails (home page, category rails, "more like this").
     * Search still returns it — useful for 18+ titles, library-only deep cuts, etc.
     * Default false. Filtering applied via the {@code excludeHidden} Hibernate filter.
     */
    @Column(name = "hide_from_rails", nullable = false)
    @Builder.Default
    private boolean hideFromRails = false;

}