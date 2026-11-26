package com.db.dbworld.app.ipo.dto;

import java.time.Instant;

/** One entry in the recent-changes feed. The event id makes keyset pagination stable. */
public record IpoChangeDto(String id, String ipoId, String eventType, String oldValue, String newValue,
                           Instant createdAt) {}
