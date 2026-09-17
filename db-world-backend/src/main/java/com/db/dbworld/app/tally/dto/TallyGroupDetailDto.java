package com.db.dbworld.app.tally.dto;

import com.db.dbworld.app.tally.entity.TallyGroupKind;

import java.time.Instant;
import java.util.List;

/**
 * A group opened up: who is in it, and where everyone stands.
 *
 * <p>The roster includes people who have left. Their names still have to render on the expenses
 * they were part of - an old dinner reading "paid by (unknown)" is worse than useless - so
 * filtering to active members is the caller's job, and only for participant pickers.
 *
 * @param myMemberId which row in {@code members} is the caller's own.
 *                   <p>Told to the client rather than worked out by it. Almost every screen
 *                   needs it — "you owe", "you paid", which balance to highlight — and the
 *                   alternative is the client digging its own user id out of a token and
 *                   matching on it, which duplicates identity logic on the far side of the
 *                   wire and quietly breaks for a member who is a ghost the caller claimed.
 */
public record TallyGroupDetailDto(
        String id,
        String name,
        TallyGroupKind kind,
        String icon,
        String category,
        String currency,
        boolean archived,
        Instant createdAt,
        String myMemberId,
        List<TallyMemberDto> members
) {}
