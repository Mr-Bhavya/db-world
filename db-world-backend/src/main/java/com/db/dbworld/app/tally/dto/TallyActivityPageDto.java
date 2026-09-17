package com.db.dbworld.app.tally.dto;

import java.time.Instant;
import java.util.List;

/**
 * One page of history, newest first.
 *
 * <p>Keyset-paginated on {@code (createdAt, id)} like the expense feed, and for a sharper
 * reason here: one user action writes several activity rows in the same instant, so the
 * timestamps really do collide and the id is doing the work rather than being a formality.
 */
public record TallyActivityPageDto(
        List<TallyActivityDto> items,
        Instant nextCursorAt,
        String nextCursorId,
        boolean hasMore
) {}
