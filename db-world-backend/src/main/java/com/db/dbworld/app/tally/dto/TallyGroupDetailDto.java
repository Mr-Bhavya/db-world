package com.db.dbworld.app.tally.dto;

import java.time.Instant;
import java.util.List;

/**
 * A group opened up: who is in it, and where everyone stands.
 *
 * <p>The roster includes people who have left. Their names still have to render on the expenses
 * they were part of - an old dinner reading "paid by (unknown)" is worse than useless - so
 * filtering to active members is the caller's job, and only for participant pickers.
 */
public record TallyGroupDetailDto(
        String id,
        String name,
        String category,
        String currency,
        boolean archived,
        Instant createdAt,
        List<TallyMemberDto> members
) {}
