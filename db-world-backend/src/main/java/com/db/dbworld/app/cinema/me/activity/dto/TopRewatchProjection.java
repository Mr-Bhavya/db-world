package com.db.dbworld.app.cinema.me.activity.dto;

import java.time.Instant;

public interface TopRewatchProjection {
    Long getRecordId();
    String getTitle();
    String getRecordType();
    Integer getDownloadCount();
    Integer getStreamCount();
    Integer getTotalCount();
    Instant getLastCompletedAt();
}
