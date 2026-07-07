package com.db.dbworld.app.cinema.catalogrequest.entity;

import com.db.dbworld.app.cinema.enums.RecordType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/**
 * A request to ingest a TMDB title that does not yet exist in the catalog.
 * Distinct from MediaRequestEntity (which requires an existing record).
 */
@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "catalog_ingest_requests",
        schema = "db_world",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_catalog_ingest_request_tmdb",
                columnNames = {"tmdb_id", "media_type"}
        ),
        // Admin queue: countByStatus + findAllByStatus ORDER BY created_at.
        indexes = @Index(name = "idx_catalog_req_status_created", columnList = "status, created_at")
)
public class CatalogIngestRequestEntity implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tmdb_id", nullable = false)
    private Long tmdbId;

    @Enumerated(EnumType.STRING)
    @Column(name = "media_type", nullable = false, length = 20)
    private RecordType mediaType;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(name = "poster_path", length = 200)
    private String posterPath;

    /** Year only (e.g. "2024") — captured for display so admins can disambiguate remakes. */
    @Column(name = "release_year", length = 10)
    private String releaseYear;

    /** Optional free-text note from the first requester (e.g. "the 2008 version please"). */
    @Column(length = 500)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private CatalogIngestRequestStatus status = CatalogIngestRequestStatus.PENDING;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "ingested_at")
    private Instant ingestedAt;

    @Column(name = "ingested_by_user_id")
    private Long ingestedByUserId;

    @Column(name = "ingested_by_username", length = 150)
    private String ingestedByUsername;

    /** Set after a successful ingest so the notification can deep-link to the new record. */
    @Column(name = "created_record_id")
    private Long createdRecordId;

    @Column(name = "dismiss_reason", length = 500)
    private String dismissReason;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(
            name = "catalog_ingest_request_voters",
            schema = "db_world",
            joinColumns = @JoinColumn(name = "request_id"),
            uniqueConstraints = @UniqueConstraint(
                    name = "uk_catalog_ingest_request_voter",
                    columnNames = {"request_id", "user_id"}
            )
    )
    @Column(name = "user_id", nullable = false)
    @Builder.Default
    private Set<Long> voterUserIds = new HashSet<>();
}
