package com.db.dbworld.app.cinema.catalog.dto;

import com.db.dbworld.app.cinema.enums.RecordType;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Instant;

/**
 * Concrete {@link RecordAdminRowDto} used by the hand-built native admin-table
 * query in {@code RecordRepositoryImpl}. Field order matches the SELECT column
 * order so it can be populated positionally from the JDBC result.
 */
@Getter
@AllArgsConstructor
public class RecordAdminRowView implements RecordAdminRowDto {

    private final Long recordId;
    private final String name;
    private final RecordType type;
    private final Long tmdbId;
    private final Integer year;
    private final Instant createdAt;
    private final Instant updatedAt;
    private final Boolean hideFromRails;
    private final String tags;
    private final String syncStatus;
    private final Instant lastSyncedAt;
    private final Instant lastCheckedAt;
    private final String syncError;
    private final Long mediaFileCount;
    private final Long mediaTotalSize;
}
