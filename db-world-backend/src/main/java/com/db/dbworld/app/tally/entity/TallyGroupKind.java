package com.db.dbworld.app.tally.entity;

/**
 * Whether a ledger is a group or a running total with one other person.
 *
 * <p>Both are the same rows underneath — a {@link #DIRECT} ledger <em>is</em> a group with two
 * members, and every expense, balance and settlement works on it unchanged. The distinction is
 * entirely about how it is presented: "Amma" is a person you owe money to, not a group you are
 * in, and making somebody invent a group name to record one shared taxi is the kind of friction
 * that stops an app being used.
 *
 * <p>A second concept with its own tables would have meant a second ledger, a second balance
 * query and a second way for the arithmetic to be wrong. This is one column.
 */
public enum TallyGroupKind {
    /** Several people sharing a household, a trip, a night out. */
    GROUP,
    /** Just the two of you. Promoted to {@link #GROUP} the moment a third person is added. */
    DIRECT
}
