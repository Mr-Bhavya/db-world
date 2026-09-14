package com.db.dbworld.app.tally.dto;

import com.db.dbworld.app.tally.entity.TallyGroupKind;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A group as it appears in the caller's list.
 *
 * @param myBalance the <em>caller's</em> net position: positive means the group owes them.
 *                  Zero for a group that is square, which is also what somebody who has never
 *                  spent anything sees - both mean there is nothing to do here.
 */
public record TallyGroupSummaryDto(
        String id,
        String name,
        /** GROUP, or DIRECT for a running total with one person. For DIRECT, `name` is them. */
        TallyGroupKind kind,
        /** An emoji. Never null once created — the server picks one if the user does not. */
        String icon,
        String category,
        String currency,
        boolean archived,
        int memberCount,
        BigDecimal myBalance,
        Instant updatedAt
) {}
