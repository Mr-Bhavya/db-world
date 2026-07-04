package com.db.dbworld.audit.tracking.me.dto;

import java.math.BigDecimal;

/**
 * Header stats for the personal {@code /me/activity} page, aggregated over
 * the caller's own {@code activity_session} rows.
 *
 * @param streamCount     number of STREAM sessions
 * @param downloadCount   number of DOWNLOAD sessions
 * @param distinctTitles  distinct {@code record_id} values touched (STREAM/DOWNLOAD)
 * @param gbDelivered     Σ unique_bytes across all sessions, in decimal GB (bytes / 1e9)
 * @param watchHours      Σ watch_duration_ms across STREAM sessions, in hours
 * @param completionRate  percent (0-100) of sessions that reached COMPLETED
 */
public record MeActivitySummaryDto(
        long streamCount,
        long downloadCount,
        long distinctTitles,
        BigDecimal gbDelivered,
        BigDecimal watchHours,
        BigDecimal completionRate
) {}
