package com.db.dbworld.app.tally.dto;

import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The window a report covers, asked for either way.
 *
 * <p>Pure date arithmetic, so it is tested on its own rather than through a service that needs a
 * database to say anything. The cases that matter are the ones where the two ways of asking
 * disagree — a calendar step versus an equally long stretch — and the boundaries where a range
 * changes how finely it is drawn.
 */
@DisplayName("db-tally report window")
class TallyReportWindowTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 15);

    private static LocalDate d(int y, int m, int day) {
        return LocalDate.of(y, m, day);
    }

    @Nested
    @DisplayName("a named calendar period")
    class Calendar {

        @Test
        @DisplayName("is the whole calendar month, and its comparison is the month before")
        void month() {
            var window = TallyReportWindow.of(TallyReportPeriod.MONTH, TODAY, null, null, TODAY);

            assertThat(window.custom()).isFalse();
            assertThat(window.from()).isEqualTo(d(2026, 9, 1));
            assertThat(window.to()).isEqualTo(d(2026, 9, 30));
            // August, all 31 days of it -- not "the 30 days before September".
            assertThat(window.previousFrom()).isEqualTo(d(2026, 8, 1));
            assertThat(window.previousTo()).isEqualTo(d(2026, 8, 31));
            assertThat(window.buckets()).hasSize(30);
            assertThat(window.previousBuckets()).hasSize(31);
        }

        @Test
        @DisplayName("charts a week by weekday, a month by day and a year by month")
        void units() {
            assertThat(TallyReportWindow.of(TallyReportPeriod.WEEK, TODAY, null, null, TODAY).unit())
                    .isEqualTo(TallyBucketUnit.WEEKDAY);
            assertThat(TallyReportWindow.of(TallyReportPeriod.MONTH, TODAY, null, null, TODAY).unit())
                    .isEqualTo(TallyBucketUnit.DAY);

            var year = TallyReportWindow.of(TallyReportPeriod.YEAR, TODAY, null, null, TODAY);
            assertThat(year.unit()).isEqualTo(TallyBucketUnit.MONTH);
            assertThat(year.buckets()).hasSize(12);
            assertThat(year.buckets().getFirst().start()).isEqualTo(d(2026, 1, 1));
            assertThat(year.buckets().getFirst().end()).isEqualTo(d(2026, 1, 31));
        }

        @Test
        @DisplayName("offers no step into a period that has not begun")
        void noStepIntoTheFuture() {
            var current = TallyReportWindow.of(TallyReportPeriod.MONTH, TODAY, null, null, TODAY);
            assertThat(current.nextAnchor()).isNull();
            assertThat(current.previousAnchor()).isNotNull();

            var past = TallyReportWindow.of(TallyReportPeriod.MONTH, d(2026, 7, 4), null, null, TODAY);
            assertThat(past.nextAnchor()).isNotNull();
        }

        @Test
        @DisplayName("counts only the days that have happened, so a mid-month average is honest")
        void elapsedDays() {
            var september = TallyReportWindow.of(TallyReportPeriod.MONTH, TODAY, null, null, TODAY);
            assertThat(september.elapsedDays(TODAY)).isEqualTo(15);

            var august = TallyReportWindow.of(TallyReportPeriod.MONTH, d(2026, 8, 3), null, null, TODAY);
            assertThat(august.elapsedDays(TODAY))
                    .as("a month that is over has elapsed entirely")
                    .isEqualTo(31);
        }
    }

    @Nested
    @DisplayName("an explicit range")
    class Custom {

        @Test
        @DisplayName("is exactly the dates given, whatever period was also sent")
        void datesWin() {
            // MONTH is the endpoint's default, so it arrives on every request. A range must
            // override it rather than being quietly rounded out to the month containing it.
            var window = TallyReportWindow.of(
                    TallyReportPeriod.MONTH, TODAY, d(2026, 3, 10), d(2026, 5, 20), TODAY);

            assertThat(window.custom()).isTrue();
            assertThat(window.period()).isNull();
            assertThat(window.from()).isEqualTo(d(2026, 3, 10));
            assertThat(window.to()).isEqualTo(d(2026, 5, 20));
        }

        @Test
        @DisplayName("compares against the equally long stretch immediately before it")
        void previousIsTheSameLength() {
            // 1–30 June: thirty days, so the comparison is the thirty days ending 31 May.
            var window = TallyReportWindow.of(null, null, d(2026, 6, 1), d(2026, 6, 30), TODAY);

            assertThat(window.previousTo())
                    .as("contiguous -- a gap would drop whatever fell in it")
                    .isEqualTo(d(2026, 5, 31));
            assertThat(window.previousFrom()).isEqualTo(d(2026, 5, 2));
            assertThat(window.buckets()).hasSize(30);
            assertThat(window.previousBuckets()).hasSize(30);
        }

        @Test
        @DisplayName("hands the client no anchors, because stepping one of these is a shift")
        void noAnchors() {
            var window = TallyReportWindow.of(null, null, d(2026, 6, 1), d(2026, 6, 30), TODAY);

            assertThat(window.previousAnchor()).isNull();
            assertThat(window.nextAnchor()).isNull();
        }

        @Test
        @DisplayName("is drawn per day up to two months, per month up to two years, then per year")
        void granularityFollowsTheSpan() {
            // 62 days exactly -- the last span still worth a column each.
            var daily = TallyReportWindow.of(null, null, d(2026, 1, 1), d(2026, 3, 3), TODAY);
            assertThat(daily.unit()).isEqualTo(TallyBucketUnit.DAY);
            assertThat(daily.buckets()).hasSize(62);

            var monthly = TallyReportWindow.of(null, null, d(2026, 1, 1), d(2026, 3, 4), TODAY);
            assertThat(monthly.unit()).isEqualTo(TallyBucketUnit.MONTH);
            assertThat(monthly.buckets()).hasSize(3);

            var yearly = TallyReportWindow.of(null, null, d(2020, 1, 1), d(2026, 1, 1), TODAY);
            assertThat(yearly.unit()).isEqualTo(TallyBucketUnit.YEAR);
            assertThat(yearly.buckets()).hasSize(7);
        }

        @Test
        @DisplayName("clips its first and last columns to the range rather than the calendar")
        void columnsAreClipped() {
            // Charted per month, but it does not start on the 1st. The opening column must cover
            // the 10th onwards only: rounding it out to 1 March would draw nine days of spending
            // the total above the chart does not include.
            var window = TallyReportWindow.of(null, null, d(2026, 3, 10), d(2026, 5, 20), TODAY);
            var buckets = window.buckets();

            assertThat(buckets).hasSize(3);
            assertThat(buckets.getFirst().start()).isEqualTo(d(2026, 3, 10));
            assertThat(buckets.getFirst().end()).isEqualTo(d(2026, 3, 31));
            assertThat(buckets.get(1).start()).isEqualTo(d(2026, 4, 1));
            assertThat(buckets.getLast().start()).isEqualTo(d(2026, 5, 1));
            assertThat(buckets.getLast().end())
                    .as("and the closing column stops at the range, not the end of the month")
                    .isEqualTo(d(2026, 5, 20));
        }

        @Test
        @DisplayName("counts elapsed days only up to today")
        void elapsedStopsAtToday() {
            var running = TallyReportWindow.of(null, null, d(2026, 9, 1), d(2026, 12, 31), TODAY);
            assertThat(running.elapsedDays(TODAY)).isEqualTo(15);

            var future = TallyReportWindow.of(null, null, d(2026, 11, 1), d(2026, 11, 30), TODAY);
            assertThat(future.elapsedDays(TODAY)).isZero();
        }

        @Test
        @DisplayName("refuses a range it cannot honestly draw")
        void refusesNonsense() {
            assertThatThrownBy(() ->
                    TallyReportWindow.of(null, null, d(2026, 5, 1), d(2026, 4, 1), TODAY))
                    .isInstanceOf(DbWorldException.class)
                    .hasMessageContaining("before its start");

            // One end without the other is a half-written request, not a request for the month.
            assertThatThrownBy(() ->
                    TallyReportWindow.of(TallyReportPeriod.MONTH, null, d(2026, 5, 1), null, TODAY))
                    .isInstanceOf(DbWorldException.class)
                    .hasMessageContaining("both a start and an end");

            assertThatThrownBy(() ->
                    TallyReportWindow.of(null, null, d(1990, 1, 1), d(2026, 1, 1), TODAY))
                    .isInstanceOf(DbWorldException.class)
                    .hasMessageContaining("ten years");
        }
    }
}
