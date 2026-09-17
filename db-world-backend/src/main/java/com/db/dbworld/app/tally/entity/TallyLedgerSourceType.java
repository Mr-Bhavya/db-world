package com.db.dbworld.app.tally.entity;

/** Which kind of row caused a ledger entry, paired with {@code source_id} to find it again. */
public enum TallyLedgerSourceType {
    EXPENSE,
    SETTLEMENT
}
