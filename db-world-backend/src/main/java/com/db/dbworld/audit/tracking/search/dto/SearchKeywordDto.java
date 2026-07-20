package com.db.dbworld.audit.tracking.search.dto;

/** One row in the "top search keywords" table on the admin Activity console. */
public record SearchKeywordDto(
        String query,
        long searchCount,
        long zeroResultCount
) {}
