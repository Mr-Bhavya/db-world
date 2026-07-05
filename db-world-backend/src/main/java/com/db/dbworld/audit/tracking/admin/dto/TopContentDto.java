package com.db.dbworld.audit.tracking.admin.dto;

/** One row in the "top content" table on the admin Activity console. */
public record TopContentDto(
        Long recordId,
        String title,
        String recordType,
        long streamCount,
        long downloadCount,
        long uniqueUsers
) {}
