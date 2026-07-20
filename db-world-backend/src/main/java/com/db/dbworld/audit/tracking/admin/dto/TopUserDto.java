package com.db.dbworld.audit.tracking.admin.dto;

import java.math.BigDecimal;
import java.time.Instant;

/** One row in the "top users" table on the admin Activity console. */
public record TopUserDto(
        Long userId,
        String email,
        Instant lastActive,
        long totalSessions,
        BigDecimal totalGb
) {}
