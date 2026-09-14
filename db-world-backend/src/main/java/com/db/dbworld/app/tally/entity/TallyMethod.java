package com.db.dbworld.app.tally.entity;

/**
 * How an expense's total was divided among its beneficiaries.
 *
 * <p>Stored even though the resulting share rows are authoritative on their own: without it,
 * re-opening an expense to edit it cannot tell an EQUAL split of ₹300 across three people from
 * an EXACT one that happens to be ₹100 each, and the edit dialog would have to guess.
 */
public enum TallyMethod {
    /** Everyone owes the same, to the paisa. */
    EQUAL,
    /** The client supplies each amount; they must add up to the total. */
    EXACT,
    /** Percentages, which must add up to 100. */
    PERCENT,
    /** Relative weights — "two shares for the couple, one each for the rest". */
    SHARES
}
