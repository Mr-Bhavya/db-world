package com.db.dbworld.app.media.ingestion.tracking.log;

import java.time.Instant;

public record LogEvent(
        Instant timestamp,
        String level,
        String step,
        String message
) {}
