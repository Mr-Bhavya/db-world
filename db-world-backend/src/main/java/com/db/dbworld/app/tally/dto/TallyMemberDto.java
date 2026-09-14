package com.db.dbworld.app.tally.dto;

import com.db.dbworld.app.tally.entity.TallyMemberRole;
import com.db.dbworld.app.tally.entity.TallyMemberStatus;

import java.math.BigDecimal;

/**
 * One member, with where they stand.
 *
 * @param ghost             true when there is no account behind this person
 * @param paidForByMemberId who settles their shares by default, or null for themselves
 * @param balance           net position; positive means the group owes them
 */
public record TallyMemberDto(
        String id,
        Long userId,
        String displayName,
        String email,
        TallyMemberRole role,
        TallyMemberStatus status,
        boolean ghost,
        String paidForByMemberId,
        BigDecimal balance
) {}
