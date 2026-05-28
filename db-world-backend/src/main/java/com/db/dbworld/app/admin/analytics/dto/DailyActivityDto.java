package com.db.dbworld.app.admin.analytics.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One day of aggregate activity for the trend chart.
 */
public record DailyActivityDto(
        LocalDate date,
        long streams,
        long downloads,
        BigDecimal gb
) {}
