package com.db.dbworld.app.split.entity;

/** Which kind of row caused a ledger entry, paired with {@code source_id} to find it again. */
public enum SplitLedgerSourceType {
    EXPENSE,
    SETTLEMENT
}
