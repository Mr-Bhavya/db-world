package com.db.dbworld.app.admin.analytics.dto;

public interface TopRecordProjection {
    Long getRecordId();
    String getTitle();
    String getRecordType();
    Long getStreamCount();
    Long getDownloadCount();
    Long getUniqueUsers();
}
