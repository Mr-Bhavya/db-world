package com.db.dbworld.app.tally.dto;

import com.db.dbworld.app.tally.entity.TallyMemberRole;
import com.db.dbworld.app.tally.entity.TallyMemberStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** What the API hands back for groups and members. */
public final class TallyViews {

    private TallyViews() {}

    /**
     * A group as it appears in the caller's list.
     *
     * @param myBalance the <em>caller's</em> net position: positive means the group owes them.
     *                  Zero for a group that is square, which is also what somebody who has
     *                  never spent anything sees — both mean "nothing to do here".
     */
    public record GroupSummary(
            String id,
            String name,
            String category,
            String currency,
            boolean archived,
            int memberCount,
            BigDecimal myBalance,
            Instant updatedAt
    ) {}

    /** A group opened up: who is in it, and where everyone stands. */
    public record GroupDetail(
            String id,
            String name,
            String category,
            String currency,
            boolean archived,
            Instant createdAt,
            List<Member> members
    ) {}

    /**
     * One member, with their balance.
     *
     * @param ghost              true when there is no account behind this person
     * @param paidForByMemberId  who settles their shares by default, or null for themselves
     * @param balance            net position; positive means the group owes them
     */
    public record Member(
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
}
