package com.db.dbworld.audit.tracking.admin.dto;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * One row in the admin Activity console's sessions list/search table.
 * Built in the service from {@code ActivitySessionEntity} rows (via
 * {@code ActivitySessionRepository#search}) enriched with {@code userEmail}
 * and {@code recordName} resolved via a batch lookup — see
 * {@code AdminActivityService#searchSessions} for the rationale.
 */
public record SessionRowDto(
        String sessionId,
        Long userId,
        String userEmail,
        Long recordId,
        String recordName,
        Integer seasonNumber,
        Integer episodeNumber,
        String fileName,
        String activity,
        String channel,
        String clientApp,
        String state,
        BigDecimal completionPercent,
        Long uniqueBytes,
        Long fileSize,
        Long avgSpeedBps,
        Long maxSpeedBps,
        Integer peakConnections,
        Instant startedAt,
        Instant lastEventAt,
        Instant completedAt,
        String lastErrorCode,
        String lastErrorMessage,
        Integer attemptCount,
        Integer pauseCount,
        Integer resumeCount,
        Integer failCount,
        Long nginxTransferredBytes
) {}
