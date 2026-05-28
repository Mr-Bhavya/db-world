package com.db.dbworld.app.admin.analytics.dto;

/** Per-client_type usage count for the donut breakdown. */
public record ClientBreakdownDto(
        String clientType,
        long count
) {}
