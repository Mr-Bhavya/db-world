package com.db.dbworld.app.admin.analytics.dto;

import java.time.Instant;

public interface TopUserProjection {
    Long getUserId();
    String getEmail();
    Instant getLastActive();
    Long getTotalActivities();
    Long getTotalBytes();
}
