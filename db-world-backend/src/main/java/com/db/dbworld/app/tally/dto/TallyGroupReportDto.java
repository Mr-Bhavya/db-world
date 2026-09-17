package com.db.dbworld.app.tally.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * What one group spent over a week, a month or a year.
 *
 * <p>The counterpart to {@link TallySpendingReportDto}, and a different question: that one is
 * "what did I consume, everywhere", this one is "what did this group cost, and who carried it".
 * So the headline here is the group's whole spend rather than the caller's slice, and the
 * per-member rows carry paid <em>and</em> consumed instead of consumption alone.
 *
 * @param total     every live expense in the period, at full value — not divided by anybody.
 * @param myShare   the caller's own consumption inside this group, so the reader can find
 *                  themselves in a number that is otherwise about everybody.
 * @param settled   money handed over between members in the period. Reported <b>beside</b> the
 *                  spending and never inside it: a settlement moves money that was already
 *                  counted when the expense was recorded, and adding the two books every
 *                  shared bill twice.
 * @param nextAnchor null when the following period has not started yet — see
 *                  {@link TallySpendingReportDto}. Null for a custom range too: stepping one
 *                  of those means shifting both ends by its own length, which needs no anchor.
 * @param period    null when the caller asked for an explicit {@code from}–{@code to} range
 *                  rather than naming a calendar period.
 */
public record TallyGroupReportDto(
        TallyReportPeriod period,
        LocalDate from,
        LocalDate to,
        LocalDate previousAnchor,
        LocalDate nextAnchor,
        String currency,
        BigDecimal total,
        BigDecimal previousTotal,
        BigDecimal myShare,
        BigDecimal settled,
        /** Group spend over the days elapsed, not over the whole period. */
        BigDecimal dailyAverage,
        int expenseCount,
        /**
         * How wide one bucket is, so the client can label the axis instead of inferring the
         * granularity from {@code period} — which stops being possible the moment a window is
         * an arbitrary range rather than one of the three calendar periods.
         */
        TallyBucketUnit bucketUnit,
        /** Every bucket in the period, including the empty ones. */
        List<TallyReportBucketDto> buckets,
        /**
         * The same buckets for the period before this one, so the client can draw last month
         * behind this one and answer "are we ahead or behind" partway through.
         *
         * <p>Sent as well as {@code previousTotal}, not instead of it: a total is the answer at
         * the end of the period, and for most of the month the interesting comparison is against
         * where the last one had got to <em>by this day</em>. Periods differ in length — a
         * 31-day January against a 28-day February — so these are aligned by index, not by date,
         * and the client drops whatever runs past the end of the current period.
         */
        List<TallyReportBucketDto> previousBuckets,
        /** Largest first. */
        List<TallyReportCategoryDto> categories,
        /** Every member who paid or consumed anything, biggest consumer first. */
        List<TallyGroupReportMemberDto> members,
        /** The largest single expense, at full value. */
        TallyReportExpenseDto biggest
) {}
