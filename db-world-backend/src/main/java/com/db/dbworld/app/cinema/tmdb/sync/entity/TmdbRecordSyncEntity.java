package com.db.dbworld.app.cinema.tmdb.sync.entity;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.cinema.tmdb.enums.SyncStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "tmdb_record_sync",
    // The tmdb association is read-only (insertable/updatable=false), so it creates NO FK index;
    // every lookup/scheduler query below hits unindexed columns without these.
    indexes = {
        @Index(name = "idx_sync_tmdb_type", columnList = "tmdb_id, record_type"),      // findByTmdbIdAndRecordType
        @Index(name = "idx_sync_type_checked", columnList = "record_type, last_checked_at"), // pick-next-to-sync
        @Index(name = "idx_sync_status_type", columnList = "status, record_type")       // countByStatus / findByStatus[AndType]
    }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TmdbRecordSyncEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tmdb_id", nullable = false)
    private Long tmdbId;

    @Enumerated(EnumType.STRING)
    @Column(name = "record_type", nullable = false)
    private RecordType recordType;

    @Column(name = "last_checked_at")
    private Instant lastCheckedAt;

    @Column(name = "last_synced_at")
    private Instant lastSyncedAt;

    @Column(name = "sync_version")
    private Long syncVersion;

    @Column(name = "status")
    @Enumerated(EnumType.STRING)
    private SyncStatus status;

    /** Last error message from a failed sync attempt. Cleared on success. */
    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    /** Catalog record ID — FK to records.id. Populated on first sync; null for legacy rows. */
    @Column(name = "record_id")
    private Long recordId;

    /** Read-only join to TmdbEntity to resolve the title without a separate query. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tmdb_id", insertable = false, updatable = false)
    private TmdbEntity tmdb;
}