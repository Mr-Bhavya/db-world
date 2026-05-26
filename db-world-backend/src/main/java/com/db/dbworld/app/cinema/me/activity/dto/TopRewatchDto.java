package com.db.dbworld.app.cinema.me.activity.dto;

import java.time.Instant;

/**
 * One entry in the "top rewatches" strip on the {@code /me/activity} page.
 * Aggregates download_count + stream_count for the user on a given record.
 */
public record TopRewatchDto(
        Long recordId,
        String title,
        String recordType,
        Integer downloadCount,
        Integer streamCount,
        Integer totalCount,
        Instant lastCompletedAt
) {}
