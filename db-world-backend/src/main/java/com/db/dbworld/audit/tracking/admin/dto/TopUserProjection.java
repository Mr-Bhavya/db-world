package com.db.dbworld.audit.tracking.admin.dto;

import java.time.Instant;

public interface TopUserProjection {
    Long getUserId();
    String getEmail();
    Instant getLastActive();
    Long getTotalSessions();
    Long getTotalBytes();
}
