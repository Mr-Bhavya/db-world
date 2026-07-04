package com.db.dbworld.audit.tracking.me.dto;

import java.math.BigDecimal;

/**
 * Native aggregate projection backing {@link MeActivitySummaryDto}, over all
 * of {@code activity_session WHERE user_id = :uid} — modeled on
 * {@code OverviewProjection} in the admin package.
 */
public interface MeSummaryProjection {
    Long getStreamCount();
    Long getDownloadCount();
    Long getDistinctTitles();
    Long getUniqueBytes();
    Long getWatchDurationMs();
    BigDecimal getAvgCompletionPercent();
    Long getCompletedCount();
    Long getTotalCount();
}
