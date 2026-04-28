package com.db.dbworld.app.cinema.tmdb.sync.dto;

import java.time.Instant;

public record SyncRecordDto(
        Long id,
        Long tmdbId,
        String recordType,
        String status,
        Instant lastCheckedAt,
        Instant lastSyncedAt,
        Long syncVersion,
        String errorMessage,
        String title
) {}
