package com.db.dbworld.app.cinema.catalog.dto;

import com.db.dbworld.app.cinema.enums.RecordType;

import java.time.Instant;

public interface RecordAdminRowDto {

    Long getRecordId();

    String getName();

    RecordType getType();

    Long getTmdbId();

    Integer getYear();

    Instant getCreatedAt();

    Instant getUpdatedAt();

    String getTags();

    Boolean getHideFromRails();

    /* ── TMDB sync state (LEFT JOIN tmdb_record_sync; null when never synced) ── */

    /** SUCCESS / FAILED / SKIPPED / RUNNING, or null if the record has no sync row yet. */
    String getSyncStatus();

    Instant getLastSyncedAt();

    Instant getLastCheckedAt();

    String getSyncError();

    /* ── Media file rollup (per-record COUNT + SUM(file_size); 0 when none) ── */

    Long getMediaFileCount();

    Long getMediaTotalSize();
}