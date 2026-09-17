package com.db.dbworld.app.tally.dto;

import com.db.dbworld.app.tally.dto.TallyReportPeriod.Bucket;

import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;

/**
 * How wide one column of a spending chart is.
 *
 * <p>Sent to the client as well as used here, because the axis labels depend on it and the
 * client was previously <em>inferring</em> it from the period: a week meant weekday names, a
 * month meant day numbers, a year meant month names. That mapping worked only while every window
 * was one of those three. A custom range of eleven weeks is none of them, so the granularity has
 * to become something the report states rather than something the reader of it guesses.
 *
 * <p>{@link #WEEKDAY} and {@link #DAY} are the same width — one day — and differ only in what the
 * client writes under them. A week is short enough to label "Mon", "Tue"; a month is not.
 */
public enum TallyBucketUnit {

    /** A day, labelled by weekday. Only a week is short enough for that to read. */
    WEEKDAY,
    /** A day, labelled by date. */
    DAY,
    MONTH,
    YEAR;

    /** Days a window can span before it is charted per month rather than per day. */
    private static final long DAILY_LIMIT = 62;
    /** Days a window can span before it is charted per year rather than per month. */
    private static final long MONTHLY_LIMIT = 731;

    /** The granularity a window of this many days is worth drawing at. */
    public static TallyBucketUnit forSpan(long days) {
        if (days <= DAILY_LIMIT) return DAY;
        if (days <= MONTHLY_LIMIT) return MONTH;
        return YEAR;
    }

    /** What the three calendar periods are charted in — the mapping the client used to assume. */
    public static TallyBucketUnit of(TallyReportPeriod period) {
        return switch (period) {
            case WEEK -> WEEKDAY;
            case MONTH -> DAY;
            case YEAR -> MONTH;
        };
    }

    /**
     * Every column between two dates, inclusive, including the empty ones.
     *
     * <p>The empty ones matter: a chart drawn only from the days money was spent compresses a
     * quiet fortnight into nothing and makes a steady month and a single blowout look identical.
     *
     * <p>The first and last columns are <b>clipped</b> to the range rather than rounded out to
     * the calendar. A range starting on the 10th of March charted per month opens with a column
     * covering the 10th to the 31st, not one that silently includes the first nine days — the
     * chart has to add up to the total printed above it.
     */
    public List<Bucket> bucketsBetween(LocalDate from, LocalDate to) {
        List<Bucket> buckets = new ArrayList<>();
        LocalDate cursor = from;

        while (!cursor.isAfter(to)) {
            LocalDate end = switch (this) {
                case WEEKDAY, DAY -> cursor;
                case MONTH -> cursor.with(TemporalAdjusters.lastDayOfMonth());
                case YEAR -> cursor.with(TemporalAdjusters.lastDayOfYear());
            };
            LocalDate clipped = end.isAfter(to) ? to : end;
            buckets.add(new Bucket(cursor, clipped));
            cursor = clipped.plusDays(1);
        }
        return buckets;
    }
}
