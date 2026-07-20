package com.db.dbworld.audit.tracking.admin.dto;

/** Per-client_app usage count for the admin Activity console donut breakdown. */
public record ClientBreakdownDto(
        String clientApp,
        long count
) {}
