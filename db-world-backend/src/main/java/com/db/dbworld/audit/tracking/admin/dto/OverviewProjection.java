package com.db.dbworld.audit.tracking.admin.dto;

/**
 * Native aggregate projection backing {@link ActivityOverviewDto}, over the
 * window passed to {@code AdminActivityService#getOverview(int)}.
 */
public interface OverviewProjection {
    Long getDownloadsToday();
    Long getStreamsToday();
    Long getUniqueUsers();
    Long getUniqueBytes();
    Long getAvgSpeedBps();
    Long getCompletedCount();
    Long getTotalCount();
}
