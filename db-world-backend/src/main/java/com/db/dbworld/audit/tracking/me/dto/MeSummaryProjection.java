package com.db.dbworld.audit.tracking.me.dto;

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
    Long getCompletedCount();
    Long getTotalCount();
}
