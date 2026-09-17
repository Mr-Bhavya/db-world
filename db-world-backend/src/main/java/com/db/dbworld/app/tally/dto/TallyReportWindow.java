package com.db.dbworld.app.tally.dto;

import com.db.dbworld.app.tally.dto.TallyReportPeriod.Bucket;
import com.db.dbworld.core.exception.DbWorldException;
import org.springframework.http.HttpStatus;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * The stretch of time a report covers, however the caller asked for it.
 *
 * <h2>Why this exists</h2>
 * A report used to be "a period and an anchor", and every figure on it — the buckets, the
 * comparison against last time, the daily average, whether there is a next window to step into —
 * was derived from those two by {@link TallyReportPeriod}'s calendar arithmetic, in two services
 * that each did it slightly differently. Adding an arbitrary {@code from}–{@code to} range meant
 * either a second copy of all of it or one place that resolves both. This is that place: the
 * services ask for a window and are handed the dates, the columns and the comparison, without
 * caring which of the two ways it was requested.
 *
 * <h2>The one semantic difference worth knowing</h2>
 * For a calendar period, "the previous one" is a <b>calendar</b> step — February against January,
 * a 28-day month against a 31-day one, because that is what a person means by "versus last
 * month". For a custom range it is the <b>equally long</b> stretch immediately before it, because
 * a 47-day range has no calendar predecessor. Both are honest answers to "compared with before";
 * they are simply not the same question, and a reader comparing an 11-week window is asking the
 * second one.
 *
 * @param period        the calendar period, or {@code null} when the caller gave explicit dates.
 * @param previousAnchor a date inside the previous window, for the client's "step back" button.
 *                      {@code null} for a custom range: stepping one of those means shifting both
 *                      ends by its own length, which the client can do without asking.
 * @param nextAnchor    as above, and {@code null} when the next window has not begun yet.
 */
public record TallyReportWindow(
        TallyReportPeriod period,
        LocalDate from,
        LocalDate to,
        TallyBucketUnit unit,
        LocalDate previousFrom,
        LocalDate previousTo,
        LocalDate previousAnchor,
        LocalDate nextAnchor
) {

    /**
     * The longest range that will be served.
     *
     * <p>Not arbitrary politeness: the columns are built in memory and handed to a chart, so an
     * open-ended range is a way to ask the server to build a hundred thousand of them. Ten years
     * is past the point where anybody is reading individual columns anyway.
     */
    private static final long MAX_SPAN_DAYS = 3653;

    /**
     * Resolve whichever way the caller asked.
     *
     * <p>Explicit dates win over the period: a caller who sends both has said what they want, and
     * silently charting the month containing {@code from} instead would be the server disagreeing
     * with them without saying so.
     */
    public static TallyReportWindow of(TallyReportPeriod period, LocalDate anchor,
                                       LocalDate from, LocalDate to, LocalDate today) {
        if (from != null || to != null) return custom(from, to);

        LocalDate at = anchor != null ? anchor : today;
        LocalDate previous = period.previousAnchor(at);
        LocalDate next = period.nextAnchor(at);

        return new TallyReportWindow(
                period,
                period.startOf(at),
                period.endOf(at),
                TallyBucketUnit.of(period),
                period.startOf(previous),
                period.endOf(previous),
                previous,
                // No forward step into a period that has not begun: there is nothing there yet,
                // and an enabled button that always lands on zero reads as a bug.
                period.startOf(next).isAfter(today) ? null : next);
    }

    private static TallyReportWindow custom(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST,
                    "A custom range needs both a start and an end date");
        }
        if (to.isBefore(from)) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST,
                    "The end of the range is before its start");
        }

        long span = ChronoUnit.DAYS.between(from, to) + 1;
        if (span > MAX_SPAN_DAYS) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST,
                    "That range covers more than ten years — pick a shorter one");
        }

        // The equally long stretch ending the day before this one starts. Contiguous on purpose:
        // a gap between the two would make the comparison quietly ignore whatever fell in it.
        LocalDate previousTo = from.minusDays(1);
        LocalDate previousFrom = previousTo.minusDays(span - 1);

        return new TallyReportWindow(null, from, to, TallyBucketUnit.forSpan(span),
                previousFrom, previousTo, null, null);
    }

    /** True when the caller gave explicit dates rather than naming a calendar period. */
    public boolean custom() {
        return period == null;
    }

    public List<Bucket> buckets() {
        return unit.bucketsBetween(from, to);
    }

    /**
     * The previous window's columns, at the same width as this one's.
     *
     * <p>Same unit deliberately, even though the previous window can be a different length — a
     * 31-day January against a 28-day February. The client lays the two over each other by
     * column index, so columns that are not the same width would put week two on top of week
     * three and call it a comparison.
     */
    public List<Bucket> previousBuckets() {
        return unit.bucketsBetween(previousFrom, previousTo);
    }

    /**
     * How many days of the window have actually happened, for a daily average that means
     * something in the middle of one.
     *
     * <p>Dividing this month's spend by 31 on the 3rd reports a daily average a tenth of the real
     * one, which is worse than showing nothing: it reads as "you are spending very little" at
     * exactly the moment the number is least trustworthy.
     */
    public long elapsedDays(LocalDate today) {
        if (today.isBefore(from)) return 0;
        LocalDate last = today.isBefore(to) ? today : to;
        return ChronoUnit.DAYS.between(from, last) + 1;
    }
}
