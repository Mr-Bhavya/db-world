package com.db.dbworld.app.cinema.tmdb.sync.entity;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.enums.SyncStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "tmdb_record_sync")
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
}