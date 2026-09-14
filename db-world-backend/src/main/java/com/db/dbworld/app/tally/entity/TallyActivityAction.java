package com.db.dbworld.app.tally.entity;

/**
 * What happened. One constant per thing a person can do to a group.
 *
 * <p>Deliberately finer-grained than the four subjects: "removed a member" and "changed who
 * pays for them" are both edits to the same row, and a feed that called them both
 * MEMBER_UPDATED would be a list of identical lines. The value of a log is being able to scan
 * it, which means the verb has to carry the meaning.
 */
public enum TallyActivityAction {

    GROUP_CREATED,
    GROUP_UPDATED,
    GROUP_ARCHIVED,
    GROUP_REOPENED,

    MEMBER_ADDED,
    MEMBER_REJOINED,
    MEMBER_UPDATED,
    MEMBER_REMOVED,
    MEMBER_CLAIMED,
    DELEGATION_SET,
    DELEGATION_CLEARED,

    EXPENSE_ADDED,
    EXPENSE_CORRECTED,
    EXPENSE_REMOVED,
    EXPENSE_RESTORED,

    SETTLEMENT_RECORDED,
    SETTLEMENT_REVERSED
}
