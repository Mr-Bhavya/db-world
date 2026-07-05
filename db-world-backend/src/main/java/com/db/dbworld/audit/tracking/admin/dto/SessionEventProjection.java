package com.db.dbworld.audit.tracking.admin.dto;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Native projection over {@code activity_event} rows for a single session's
 * timeline — backs {@link SessionEventDto}.
 */
public interface SessionEventProjection {
    Long getId();
    Instant getEventTime();
    String getEventType();
    String getSource();
    Long getBytesDelta();
    Long getCumulativeBytes();
    Long getSpeedBps();
    Integer getConnections();
    Long getPositionMs();
    BigDecimal getCompletionPercent();
    String getErrorCode();
    String getErrorMessage();
}
