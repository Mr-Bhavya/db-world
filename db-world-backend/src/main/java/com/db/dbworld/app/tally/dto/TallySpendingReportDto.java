package com.db.dbworld.app.tally.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * What the caller <em>consumed</em> over one week, month or year — their own share of every
 * expense, wherever it was split.
 *
 * <h2>Consumed, not paid</h2>
 * Every figure here comes from the caller's share of an expense, never from what they handed
 * over at the till. Someone who pays for a table of six and is reimbursed has not spent six
 * dinners, and a report that says they have is useless for the thing people want a spending
 * report for. The money-movement view already exists: it is the balances on each group.
 *
 * <p>The same reason decides the share column. A share records both who consumed it and who is
 * liable for it, and this report reads the first — so a share somebody else covers for you is
 * still yours here, and one you cover for a child or a guest is not.
 *
 * @param previousTotal the same figure for the period immediately before, for "versus last
 *                      month". Zero if there was nothing, which reads the same as a period
 *                      before the user started using the app — both mean "nothing to compare".
 * @param nextAnchor    null when the following period has not started yet, so the UI has no
 *                      forward button to press into an empty future. The server owns this
 *                      rather than the client so both agree on where a month ends.
 * @param biggest       the single largest share in the period, or null if there was none.
 */
public record TallySpendingReportDto(
        TallyReportPeriod period,
        LocalDate from,
        LocalDate to,
        LocalDate previousAnchor,
        LocalDate nextAnchor,
        String currency,
        BigDecimal total,
        BigDecimal previousTotal,
        /** Total over the days that have actually elapsed, so it means something mid-period. */
        BigDecimal dailyAverage,
        /** Distinct expenses the caller had a share in — not the number of shares. */
        int expenseCount,
        /** Every bucket in the period, including the empty ones. */
        List<TallyReportBucketDto> buckets,
        /** Largest first. */
        List<TallyReportCategoryDto> categories,
        /** Largest first. */
        List<TallyReportLedgerDto> ledgers,
        TallyReportExpenseDto biggest
) {}
