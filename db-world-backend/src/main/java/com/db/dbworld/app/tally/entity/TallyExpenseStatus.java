package com.db.dbworld.app.tally.entity;

/**
 * Whether an expense still counts toward balances.
 *
 * <p>A status column rather than a nullable {@code voided_at} for a query-shape reason:
 * {@code idx_tally_expense_group_date} puts the ACTIVE filter second, inside the seek, and a
 * nullable datetime sitting mid-composite cannot give an equality match there. Voided expenses
 * are never deleted — their ledger rows are reversed instead, so the history stays readable.
 */
public enum TallyExpenseStatus {
    ACTIVE,
    VOIDED
}
