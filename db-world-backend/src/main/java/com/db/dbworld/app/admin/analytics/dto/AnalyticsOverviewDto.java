package com.db.dbworld.app.admin.analytics.dto;

import java.math.BigDecimal;

/**
 * Four headline metrics for the admin analytics dashboard, covering the last 7 days.
 */
public record AnalyticsOverviewDto(
        long activeUsers7d,
        BigDecimal gbTransferred7d,
        long completedTransfers7d,
        BigDecimal abortedRate7d
) {}
