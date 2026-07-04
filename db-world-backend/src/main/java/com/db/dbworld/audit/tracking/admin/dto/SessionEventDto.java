package com.db.dbworld.audit.tracking.admin.dto;

import java.math.BigDecimal;
import java.time.Instant;

/** One row in a session's event timeline on the admin Activity console. */
public record SessionEventDto(
        Long id,
        Instant eventTime,
        String eventType,
        String source,
        Long bytesDelta,
        Long cumulativeBytes,
        Long speedBps,
        Integer connections,
        Long positionMs,
        BigDecimal completionPercent,
        String errorCode,
        String errorMessage
) {}
