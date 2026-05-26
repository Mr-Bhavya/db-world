package com.db.dbworld.app.admin.analytics.dto;

/** One row in the "top records" table on the admin analytics dashboard. */
public record TopRecordDto(
        Long recordId,
        String title,
        String recordType,
        long streamCount,
        long downloadCount,
        long uniqueUsers
) {}
