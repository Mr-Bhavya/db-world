package com.db.dbworld.app.ipo.dto;

import java.time.Instant;

/** One entry in the recent-changes feed. */
public record IpoChangeDto(String ipoId, String eventType, String oldValue, String newValue, Instant createdAt) {}
