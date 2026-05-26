package com.db.dbworld.app.cinema.me.activity.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Header stats for the {@code /me/activity} page.
 *
 * @param totalStreamHours   cumulative streaming time across COMPLETED stream sessions
 * @param totalDownloadGB    cumulative bytes downloaded across COMPLETED download sessions
 * @param completionRate     percent (0-100) of started sessions that reached COMPLETED
 * @param topGenres          top genres by engaged-record count (Phase 5 will populate; empty for now)
 */
public record MyActivitySummaryDto(
        BigDecimal totalStreamHours,
        BigDecimal totalDownloadGB,
        BigDecimal completionRate,
        List<String> topGenres
) {}
