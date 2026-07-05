package com.db.dbworld.audit.tracking.admin.dto;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Native LEFT JOIN projection (activity_session + users + records) backing
 * {@link LiveSessionDto} — one row per currently ACTIVE/PAUSED session.
 */
public interface LiveSessionProjection {
    String getSessionId();
    String getUserEmail();
    String getTitle();
    String getActivity();
    String getChannel();
    String getClientApp();
    String getState();
    BigDecimal getCompletionPercent();
    Long getWatchPositionMs();
    Long getWatchDurationMs();
    Long getAvgSpeedBps();
    Long getMaxSpeedBps();
    Integer getPeakConnections();
    Long getUniqueBytes();
    Long getFileSize();
    Instant getStartedAt();
    Instant getLastEventAt();
}
