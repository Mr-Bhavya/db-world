package com.db.dbworld.app.tally.dto;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;

/**
 * The window a spending report covers, and the calendar arithmetic that goes with it.
 *
 * <p>The maths lives here rather than in the service because all of it is a pure function of a
 * date, and because "the previous month" is the kind of thing that is easy to get subtly wrong
 * and impossible to notice: subtracting 30 days from 31 March lands on 1 March, so a report
 * comparing "this month" against "30 days ago" would quietly count the first of the month twice
 * and never mention it. Every boundary here is a calendar boundary.
 *
 * <p>Weeks run Monday to Sunday (ISO). That is what a week means to most of the world and it
 * makes the weekend one block at the end of the report rather than split across two.
 */
public enum TallyReportPeriod {

    WEEK, MONTH, YEAR;

    /** The first day covered by the period the anchor falls in. */
    public LocalDate startOf(LocalDate anchor) {
        return switch (this) {
            case WEEK  -> anchor.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case MONTH -> anchor.withDayOfMonth(1);
            case YEAR  -> anchor.withDayOfYear(1);
        };
    }

    /** The last day covered, inclusive — reports read "1st to 30th", not "1st to the 1st next". */
    public LocalDate endOf(LocalDate anchor) {
        return switch (this) {
            case WEEK  -> startOf(anchor).plusDays(6);
            case MONTH -> anchor.with(TemporalAdjusters.lastDayOfMonth());
            case YEAR  -> anchor.with(TemporalAdjusters.lastDayOfYear());
        };
    }

    /**
     * A date inside the period immediately before this one.
     *
     * <p>Calendar-stepped, so "last month" from 31 March is March's predecessor February and not
     * a 30-day window ending mid-March. February is shorter than January and that is the point:
     * the comparison a person means by "versus last month" is against the actual month.
     */
    public LocalDate previousAnchor(LocalDate anchor) {
        return switch (this) {
            case WEEK  -> startOf(anchor).minusWeeks(1);
            case MONTH -> startOf(anchor).minusMonths(1);
            case YEAR  -> startOf(anchor).minusYears(1);
        };
    }

    /** A date inside the period immediately after this one. */
    public LocalDate nextAnchor(LocalDate anchor) {
        return switch (this) {
            case WEEK  -> startOf(anchor).plusWeeks(1);
            case MONTH -> startOf(anchor).plusMonths(1);
            case YEAR  -> startOf(anchor).plusYears(1);
        };
    }

    /**
     * The buckets the period is charted in: a week and a month are drawn per day, a year per
     * month.
     *
     * <p>Returned as a full list of ranges including the empty ones, because a chart with the
     * quiet days missing is a different chart — it hides the gaps between spends, which for a
     * spending report is most of what there is to see.
     */
    public List<Bucket> bucketsOf(LocalDate anchor) {
        LocalDate start = startOf(anchor);
        LocalDate end = endOf(anchor);
        List<Bucket> buckets = new ArrayList<>();

        if (this == YEAR) {
            for (LocalDate m = start; !m.isAfter(end); m = m.plusMonths(1)) {
                buckets.add(new Bucket(m, m.with(TemporalAdjusters.lastDayOfMonth())));
            }
        } else {
            for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
                buckets.add(new Bucket(d, d));
            }
        }
        return buckets;
    }

    /** One column of the chart, as a date range so a day and a month are the same shape. */
    public record Bucket(LocalDate start, LocalDate end) {
        public boolean contains(LocalDate date) {
            return !date.isBefore(start) && !date.isAfter(end);
        }
    }

    /**
     * How many days of the period have actually happened, for a daily average that means
     * something mid-period.
     *
     * <p>Dividing this month's spend by 31 on the 3rd of the month reports a daily average a
     * tenth of the real one, which is worse than showing nothing: it reads as "you are spending
     * very little" at exactly the moment the number is least trustworthy. Counting only elapsed
     * days answers the question the average is actually asked for — the rate so far.
     */
    public long elapsedDays(LocalDate anchor, LocalDate today) {
        LocalDate start = startOf(anchor);
        if (today.isBefore(start)) return 0;

        LocalDate last = today.isBefore(endOf(anchor)) ? today : endOf(anchor);
        return ChronoUnit.DAYS.between(start, last) + 1;
    }
}
