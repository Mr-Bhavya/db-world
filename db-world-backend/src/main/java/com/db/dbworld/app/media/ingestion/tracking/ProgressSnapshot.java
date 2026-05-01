package com.db.dbworld.app.media.ingestion.tracking;

public record ProgressSnapshot(
        long downloadedBytes,
        long totalBytes,
        double speed,
        long eta
) {}
