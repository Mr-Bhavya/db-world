package com.db.dbworld.audit.tracking.search.dto;

/** Body for {@code POST /api/me/search-history}. */
public record RecordSearchRequest(
        String query,
        Integer resultCount,
        Long openedRecordId
) {}
