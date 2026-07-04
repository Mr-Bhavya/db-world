package com.db.dbworld.audit.tracking.ingest.dto;

import java.util.List;

/** Batch wrapper posted to {@code POST /api/track/events}. */
public record TrackBatchRequest(
        List<TrackEventRequest> events
) {}
