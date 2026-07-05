package com.db.dbworld.audit.tracking.admin.dto;

import java.math.BigDecimal;
import java.time.Instant;

/** One row in the "live now" table on the admin Activity console. */
public record LiveSessionDto(
        String sessionId,
        String userEmail,
        String title,
        String activity,
        String channel,
        String clientApp,
        String state,
        BigDecimal completionPercent,
        BigDecimal watchedPercent,
        Long watchPositionMs,
        Long watchDurationMs,
        Long avgSpeedBps,
        Long maxSpeedBps,
        Integer peakConnections,
        Long uniqueBytes,
        Long fileSize,
        Instant startedAt,
        Instant lastEventAt
) {}
