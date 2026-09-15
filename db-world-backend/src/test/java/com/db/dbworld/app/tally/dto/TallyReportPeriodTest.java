package com.db.dbworld.app.tally.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The calendar arithmetic behind a spending report.
 *
 * <p>Worth testing on its own because every bug available here is silent. A week that starts on
 * the wrong day still produces a seven-day report; "last month" done by subtracting thirty days
 * still produces a plausible number. Nothing throws, the chart still draws, and the totals are
 * simply wrong.
 *
 * <p>Weekday fixtures are built with {@link TemporalAdjusters} rather than written as literal
 * dates, so the test says "a Monday" and means it instead of asserting a date I believe is one.
 */
@DisplayName("db-tally report periods")
class TallyReportPeriodTest {

    /** The first Monday of 2026, whichever date that turns out to be. */
    private static final LocalDate MONDAY =
            LocalDate.of(2026, 1, 1).with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));

    @Nested
    @DisplayName("weeks run Monday to Sunday")
    class Weeks {

        @Test
        void aMidweekDayBelongsToItsMonday() {
            assertThat(TallyReportPeriod.WEEK.startOf(MONDAY.plusDays(3))).isEqualTo(MONDAY);
            assertThat(TallyReportPeriod.WEEK.endOf(MONDAY.plusDays(3)))
                    .isEqualTo(MONDAY.plusDays(6));
        }

        @Test
        @DisplayName("Sunday closes the week it started, it does not open the next one")
        void sundayIsTheEndNotTheBeginning() {
            // The off-by-one that a locale-default week start introduces: with Sunday as day
            // one, the weekend is split down the middle and every weekend spend lands in a
            // different report from the Saturday it went with.
            LocalDate sunday = MONDAY.plusDays(6);
            assertThat(sunday.getDayOfWeek()).isEqualTo(DayOfWeek.SUNDAY);
            assertThat(TallyReportPeriod.WEEK.startOf(sunday)).isEqualTo(MONDAY);
            assertThat(TallyReportPeriod.WEEK.endOf(sunday)).isEqualTo(sunday);
        }

        @Test
        void bothEndsAreInclusiveAndSevenDaysApart() {
            assertThat(TallyReportPeriod.WEEK.bucketsOf(MONDAY)).hasSize(7);
        }

        @Test
        void previousIsTheWeekBefore() {
            assertThat(TallyReportPeriod.WEEK.previousAnchor(MONDAY.plusDays(3)))
                    .isEqualTo(MONDAY.minusWeeks(1));
        }
    }

    @Nested
    @DisplayName("months are calendar months, of whatever length")
    class Months {

        @Test
        void startAndEnd() {
            assertThat(TallyReportPeriod.MONTH.startOf(LocalDate.of(2026, 2, 17)))
                    .isEqualTo(LocalDate.of(2026, 2, 1));
            assertThat(TallyReportPeriod.MONTH.endOf(LocalDate.of(2026, 2, 17)))
                    .isEqualTo(LocalDate.of(2026, 2, 28));
        }

        @Test
        void februaryGrowsInALeapYear() {
            assertThat(TallyReportPeriod.MONTH.endOf(LocalDate.of(2028, 2, 10)))
                    .isEqualTo(LocalDate.of(2028, 2, 29));
            assertThat(TallyReportPeriod.MONTH.bucketsOf(LocalDate.of(2028, 2, 10))).hasSize(29);
        }

        @Test
        @DisplayName("the month before the 31st of March is February, not 'thirty days ago'")
        void previousIsACalendarStepNotThirtyDays() {
            // 31 March minus 30 days is 1 March. A report built that way would compare this
            // month against a window that overlaps it, counting the 1st twice and saying
            // nothing about it.
            LocalDate previous = TallyReportPeriod.MONTH.previousAnchor(LocalDate.of(2026, 3, 31));

            assertThat(TallyReportPeriod.MONTH.startOf(previous)).isEqualTo(LocalDate.of(2026, 2, 1));
            assertThat(TallyReportPeriod.MONTH.endOf(previous)).isEqualTo(LocalDate.of(2026, 2, 28));
        }

        @Test
        @DisplayName("stepping back from the 31st and forward again does not skip a month")
        void steppingIsReversible() {
            // January has a 31st and February does not, so a naive "same day last month" lands
            // on 3 March coming back and the report quietly skips February altogether.
            LocalDate march31 = LocalDate.of(2026, 3, 31);
            LocalDate back = TallyReportPeriod.MONTH.previousAnchor(march31);

            assertThat(TallyReportPeriod.MONTH.startOf(TallyReportPeriod.MONTH.nextAnchor(back)))
                    .isEqualTo(LocalDate.of(2026, 3, 1));
        }

        @Test
        void chartedOnePerDay() {
            assertThat(TallyReportPeriod.MONTH.bucketsOf(LocalDate.of(2026, 1, 15))).hasSize(31);
        }
    }

    @Nested
    @DisplayName("years")
    class Years {

        @Test
        void startAndEnd() {
            assertThat(TallyReportPeriod.YEAR.startOf(LocalDate.of(2026, 6, 15)))
                    .isEqualTo(LocalDate.of(2026, 1, 1));
            assertThat(TallyReportPeriod.YEAR.endOf(LocalDate.of(2026, 6, 15)))
                    .isEqualTo(LocalDate.of(2026, 12, 31));
        }

        @Test
        @DisplayName("charted one bucket per month, each covering its whole month")
        void chartedPerMonth() {
            var buckets = TallyReportPeriod.YEAR.bucketsOf(LocalDate.of(2026, 6, 15));

            assertThat(buckets).hasSize(12);
            assertThat(buckets.getFirst().start()).isEqualTo(LocalDate.of(2026, 1, 1));
            assertThat(buckets.getFirst().end()).isEqualTo(LocalDate.of(2026, 1, 31));
            assertThat(buckets.get(1).end()).isEqualTo(LocalDate.of(2026, 2, 28));
            assertThat(buckets.getLast().end()).isEqualTo(LocalDate.of(2026, 12, 31));
        }

        @Test
        void everyDayOfTheYearFallsInExactlyOneBucket() {
            var buckets = TallyReportPeriod.YEAR.bucketsOf(LocalDate.of(2026, 6, 15));

            for (LocalDate d = LocalDate.of(2026, 1, 1); d.getYear() == 2026; d = d.plusDays(1)) {
                LocalDate day = d;
                assertThat(buckets.stream().filter(b -> b.contains(day)).count())
                        .as("buckets containing %s", day)
                        .isEqualTo(1);
            }
        }
    }

    @Nested
    @DisplayName("elapsed days, for an average that means something mid-period")
    class Elapsed {

        @Test
        void countsOnlyTheDaysThatHaveHappened() {
            assertThat(TallyReportPeriod.MONTH.elapsedDays(
                    LocalDate.of(2026, 9, 15), LocalDate.of(2026, 9, 15))).isEqualTo(15);
        }

        @Test
        void aFinishedPeriodCountsInFull() {
            assertThat(TallyReportPeriod.MONTH.elapsedDays(
                    LocalDate.of(2026, 8, 10), LocalDate.of(2026, 9, 15))).isEqualTo(31);
        }

        @Test
        @DisplayName("a period that has not started yet has no days, and so no average")
        void theFutureIsZero() {
            assertThat(TallyReportPeriod.MONTH.elapsedDays(
                    LocalDate.of(2026, 10, 5), LocalDate.of(2026, 9, 15))).isZero();
        }

        @Test
        void theFirstDayOfTheMonthCountsAsOne() {
            // Not zero: the day you are living through is a day you have spent money in, and
            // dividing by zero is the other thing that could happen here.
            assertThat(TallyReportPeriod.MONTH.elapsedDays(
                    LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 1))).isEqualTo(1);
        }
    }
}
