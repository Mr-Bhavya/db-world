package com.db.dbworld.app.cinema.catalog.entities;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import jakarta.persistence.*;
import lombok.*;
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
@Table(
        name = "records",
        schema = "db_world"
)
@SequenceGenerator(
        name = "records_seq",
        sequenceName = "records_seq",
        schema = "db_world",
        allocationSize = 1
)
public class RecordEntity implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "records_seq")
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

}