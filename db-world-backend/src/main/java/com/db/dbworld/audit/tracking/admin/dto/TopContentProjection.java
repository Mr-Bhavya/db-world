package com.db.dbworld.audit.tracking.admin.dto;

public interface TopContentProjection {
    Long getRecordId();
    String getTitle();
    String getRecordType();
    Long getStreamCount();
    Long getDownloadCount();
    Long getUniqueUsers();
}
