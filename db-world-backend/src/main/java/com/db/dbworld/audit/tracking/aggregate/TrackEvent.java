package com.db.dbworld.audit.tracking.aggregate;

import com.db.dbworld.audit.tracking.enums.*;
import lombok.Builder;
import java.math.BigDecimal;
import java.time.Instant;

/** One client- or server-originated tracking event (immutable). */
@Builder
public record TrackEvent(
        String clientEventId,
        String sessionId,
        ActivityKind activity,
        TrackEventType type,
        TrackChannel channel,
        ClientApp clientApp,
        TrackSource source,
        Instant eventTime,
        Long userId,
        String mediaFileId,
        Long recordId,
        Integer seasonNumber,
        Integer episodeNumber,
        String filePath,
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
        Integer resultCount,
        String remoteAddr,
        String userAgent
) {}
