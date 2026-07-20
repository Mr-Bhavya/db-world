package com.db.dbworld.audit.tracking.admin.dto;

import java.math.BigDecimal;

/**
 * Headline KPIs for the admin Activity console overview strip, computed over
 * a caller-supplied trailing window (days) plus a live "right now" count.
 */
public record ActivityOverviewDto(
        long activeNow,
        long downloadsToday,
        long streamsToday,
        long uniqueUsers,
        BigDecimal gbDelivered,
        long avgSpeedBps,
        BigDecimal completionRate
) {}
