package com.db.dbworld.audit.tracking.me.dto;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * One row in the personal {@code /me/activity} timeline. Built from
 * {@code ActivitySessionEntity} rows (via {@code ActivitySessionRepository#search})
 * enriched with {@code recordName} resolved via a batch lookup — same idiom as
 * {@code AdminActivityService#searchSessions} / {@code SessionRowDto}, chosen over a
 * native JOIN projection so the existing {@code search()} Specification query can be
 * reused as-is. {@code title} falls back to {@code fileName} when there's no linked
 * record (e.g. orphaned/unmatched files).
 */
public record MeSessionDto(
        String sessionId,
        String activity,
        String state,
        Long recordId,
        String title,
        String fileName,
        BigDecimal completionPercent,
        Long uniqueBytes,
        Long fileSize,
        Instant lastEventAt,
        Instant startedAt
) {}
