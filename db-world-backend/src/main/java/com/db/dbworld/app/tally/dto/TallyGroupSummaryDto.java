package com.db.dbworld.app.tally.dto;

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
        String category,
        String currency,
        boolean archived,
        int memberCount,
        BigDecimal myBalance,
        Instant updatedAt
) {}
