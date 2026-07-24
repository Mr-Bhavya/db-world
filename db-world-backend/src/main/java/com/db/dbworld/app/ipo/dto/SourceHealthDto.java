package com.db.dbworld.app.ipo.dto;

import java.time.Instant;

/** Poll health for one IPO data source, for the admin monitor. */
public record SourceHealthDto(String source, Instant lastPolledAt, Instant lastSuccessAt,
                              String lastStatus, int consecutiveFailures) {}
