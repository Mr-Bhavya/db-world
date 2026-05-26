package com.db.dbworld.app.admin.analytics.dto;

import java.math.BigDecimal;
import java.time.Instant;

/** One row in the "top users" table on the admin analytics dashboard. */
public record TopUserDto(
        Long userId,
        String email,
        Instant lastActive,
        long totalActivities,
        BigDecimal totalGb
) {}
