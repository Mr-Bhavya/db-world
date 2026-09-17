package com.db.dbworld.app.tally.entity;

/**
 * Whether a row is money <em>spent on something</em>, or money <em>handed over to be paid back</em>.
 *
 * <h2>Why this is a column and not a table</h2>
 * A loan and a shared bill move the ledger in exactly the same way: one member ends up owing
 * another an amount, and a payment in the other direction reduces it. Both already produce the
 * same {@link TallyLedgerEntryEntity} rows, so a loan needed no new arithmetic — it was already
 * expressible as "an expense you paid and they consumed 100% of".
 *
 * <p>What it was missing was a NAME. Recording a loan meant calling it an expense, inventing a
 * description and choosing a food-or-travel category for money that bought nothing, and the
 * per-group report — which answers "who carried it" — then described a loan as consumption.
 *
 * <p>The same argument {@link TallyGroupKind} makes for DIRECT applies here: a second concept with
 * its own tables would have meant a second ledger, a second balance query and a second way for the
 * arithmetic to be wrong. This is one column.
 *
 * <h2>Null means SPEND</h2>
 * The column is nullable on purpose. Every row that existed before this enum did is a SPEND, and
 * the schema is managed by {@code ddl-auto: update} — which can add a nullable column to a
 * populated table but cannot invent a value for a NOT NULL one. Rather than making a hand-run
 * backfill load-bearing (a hazard this project has been bitten by), reads treat null as SPEND and
 * every new row writes its kind explicitly. Run {@code tally_loans.sql} to tidy the legacy rows;
 * nothing breaks if it never runs.
 */
public enum TallyExpenseKind {

    /** Money spent on something. Counts as spending, carries a category, splits between people. */
    SPEND,

    /**
     * Money handed over, to come back.
     *
     * <p>Excluded from every spending figure: a loan is not consumption by either side, and
     * counting it would inflate the borrower's spending by the principal and then again by
     * whatever they actually buy with it.
     */
    LOAN
}
