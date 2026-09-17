package com.db.dbworld.app.tally.entity;

/**
 * Whether a recorded payment still counts.
 *
 * <p>Settlements are one-sided — recording one is enough, there is no confirmation step from the
 * other side. That makes a mistyped amount permanent unless it can be taken back, hence
 * {@link #REVERSED} plus a reversal ledger entry rather than an UPDATE or a DELETE.
 */
public enum TallySettlementStatus {
    ACTIVE,
    REVERSED
}
