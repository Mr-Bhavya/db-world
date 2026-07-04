package com.db.dbworld.audit.tracking.ingest.dto;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Client-submitted tracking event payload posted to {@code POST /api/track/events}.
 *
 * <p>All fields are nullable except {@code sessionId} and {@code type} — those two are
 * required for the event to be usable and an event missing either is skipped by the
 * controller rather than rejected outright (so one bad event in a batch never fails the rest).
 */
public record TrackEventRequest(
        String clientEventId,
        String sessionId,
        String activity,
        String type,
        String clientApp,
        Instant occurredAt,
        String mediaFileId,
        Long recordId,
        Integer seasonNumber,
        Integer episodeNumber,
        String fileName,
        Long fileSize,
        Long cumulativeBytes,
        Long speedBps,
        Integer connections,
        Long positionMs,
        Long durationMs,
        BigDecimal completionPercent,
        String errorCode,
        String errorMessage,
        String searchQuery,
        Integer resultCount
) {}
