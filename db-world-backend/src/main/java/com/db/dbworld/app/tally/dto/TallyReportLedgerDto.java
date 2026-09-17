package com.db.dbworld.app.tally.dto;

import com.db.dbworld.app.tally.entity.TallyGroupKind;

import java.math.BigDecimal;

/**
 * What the caller consumed in one ledger — a group, a one-to-one, or their own spending.
 *
 * <p>Archived ledgers and ones the caller has since left are in here too. Money spent in
 * February was still spent, and dropping it because the group has since been tidied away would
 * make last year's report change every time somebody archives something.
 */
public record TallyReportLedgerDto(
        String groupId,
        String name,
        TallyGroupKind kind,
        String icon,
        BigDecimal amount
) {}
