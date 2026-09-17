package com.db.dbworld.app.tally.entity;

/**
 * Whether a ledger entry is a posting or the undo of one.
 *
 * <p>Deliberately a separate column from {@link TallyLedgerSourceType}: folding REVERSAL in there
 * as a third source type would lose which kind of thing was reversed, and getting that back later
 * means a data migration over an append-only table.
 */
public enum TallyLedgerEntryType {
    ORIGINAL,
    REVERSAL
}
