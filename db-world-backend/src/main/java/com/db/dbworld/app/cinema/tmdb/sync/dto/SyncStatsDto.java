package com.db.dbworld.app.cinema.tmdb.sync.dto;

import java.time.Instant;

public record SyncStatsDto(
        long success,
        long failed,
        long skipped,
        long running,
        Instant lastSyncedAt
) {}
