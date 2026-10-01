package com.db.dbworld.app.cinema.tmdb.sync.dto;

import java.time.Instant;

public record SyncStatsDto(
        long success,
        long failed,
        long skipped,
        long running,
        /** Records whose latest sync got a 404 for the title itself (a subset of failed/skipped). */
        long notFound,
        Instant lastSyncedAt
) {}
