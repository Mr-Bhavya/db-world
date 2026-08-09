package com.db.dbworld.app.ipo.notification;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * The market-calendar gate: notifications only during IST market hours on a trading day
 * (weekday, non-holiday). LENIENT because several cases short-circuit before reading every setting.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class IpoMarketCalendarTest {

    @Mock SettingsService settings;

    IpoMarketCalendar calendar;

    // 2026-08-10 = Monday, 2026-08-08 = Saturday, 2026-08-09 = Sunday.
    private static final LocalDate MONDAY = LocalDate.of(2026, 8, 10);
    private static final LocalDate SATURDAY = LocalDate.of(2026, 8, 8);
    private static final LocalDate SUNDAY = LocalDate.of(2026, 8, 9);
    private static final LocalDate HOLIDAY = LocalDate.of(2026, 1, 26);          // matches recurring "01-26"
    private static final LocalDate EXACT_HOLIDAY_2026 = LocalDate.of(2026, 3, 3); // matches dated "2026-03-03"

    @BeforeEach
    void setUp() {
        when(settings.getLong(ConfigKeys.IPO_NOTIFY_WINDOW_START_HOUR)).thenReturn(10L);
        when(settings.getLong(ConfigKeys.IPO_NOTIFY_WINDOW_END_HOUR)).thenReturn(21L);
        // One recurring MM-DD holiday + one dated YYYY-MM-DD holiday.
        when(settings.getString(ConfigKeys.IPO_MARKET_HOLIDAYS)).thenReturn("01-26,2026-03-03");
        calendar = new IpoMarketCalendar(settings);
    }

    @Test
    void weekdayWithinHours_isNotificationWindow() {
        assertThat(calendar.isNotificationWindow(MONDAY.atTime(11, 30))).isTrue();
    }

    @Test
    void atStartHour_isInclusive() {
        assertThat(calendar.isNotificationWindow(MONDAY.atTime(10, 0))).isTrue();
    }

    @Test
    void beforeStartHour_suppressed() {
        assertThat(calendar.isNotificationWindow(MONDAY.atTime(9, 59))).isFalse();
    }

    @Test
    void atEndHour_isExclusive_suppressed() {
        assertThat(calendar.isNotificationWindow(MONDAY.atTime(21, 0))).isFalse();
    }

    @Test
    void overnight_suppressed() {
        assertThat(calendar.isNotificationWindow(MONDAY.atTime(0, 0))).isFalse();
        assertThat(calendar.isNotificationWindow(MONDAY.atTime(3, 0))).isFalse();
    }

    @Test
    void saturday_notTradingDay() {
        assertThat(calendar.isTradingDay(SATURDAY)).isFalse();
        assertThat(calendar.isNotificationWindow(SATURDAY.atTime(11, 0))).isFalse();
    }

    @Test
    void sunday_notTradingDay() {
        assertThat(calendar.isTradingDay(SUNDAY)).isFalse();
    }

    @Test
    void configuredHoliday_notTradingDay() {
        assertThat(calendar.isTradingDay(HOLIDAY)).isFalse();
        assertThat(calendar.isNotificationWindow(HOLIDAY.atTime(11, 0))).isFalse();
    }

    @Test
    void recurringHoliday_appliesEveryYear_soNoAnnualEditNeeded() {
        // "01-26" (MM-DD) recurs — a holiday in 2026, 2027, 2028… without any config change.
        assertThat(calendar.isTradingDay(LocalDate.of(2026, 1, 26))).isFalse();
        assertThat(calendar.isTradingDay(LocalDate.of(2027, 1, 26))).isFalse();
        assertThat(calendar.isTradingDay(LocalDate.of(2028, 1, 26))).isFalse();
        // A neighbouring weekday is still a trading day.
        assertThat(calendar.isTradingDay(LocalDate.of(2027, 1, 27))).isTrue();
    }

    @Test
    void datedHoliday_doesNotRecurNextYear() {
        // "2026-03-03" (YYYY-MM-DD) is a one-off: a holiday in 2026, but a normal trading day in 2027.
        assertThat(calendar.isTradingDay(EXACT_HOLIDAY_2026)).isFalse();
        assertThat(calendar.isTradingDay(LocalDate.of(2027, 3, 3))).isTrue();
    }

    @Test
    void autoFetchedHolidays_areUnionedWithManualList() {
        when(settings.getString(ConfigKeys.IPO_MARKET_HOLIDAYS)).thenReturn("01-26");            // manual (recurring)
        when(settings.getString(ConfigKeys.IPO_MARKET_HOLIDAYS_AUTO)).thenReturn("2026-04-03");  // auto-fetched (dated)
        // A date present only in the AUTO list is still a non-trading day.
        assertThat(calendar.isTradingDay(LocalDate.of(2026, 4, 3))).isFalse();
        // The manual recurring holiday still applies too.
        assertThat(calendar.isTradingDay(LocalDate.of(2026, 1, 26))).isFalse();
        // A weekday in neither list remains a trading day.
        assertThat(calendar.isTradingDay(MONDAY)).isTrue();
    }

    @Test
    void normalWeekday_isTradingDay() {
        assertThat(calendar.isTradingDay(MONDAY)).isTrue();
    }

    @Test
    void blankHolidayList_treatsWeekdayAsTrading() {
        when(settings.getString(ConfigKeys.IPO_MARKET_HOLIDAYS)).thenReturn("");
        assertThat(calendar.isTradingDay(HOLIDAY)).isTrue();
    }

    @Test
    void unparseableHolidayToken_ignoredButGoodOnesStillApply() {
        when(settings.getString(ConfigKeys.IPO_MARKET_HOLIDAYS)).thenReturn("not-a-date, 01-26 ");
        assertThat(calendar.isTradingDay(HOLIDAY)).isFalse(); // the valid, whitespace-padded "01-26" parsed
        assertThat(calendar.isTradingDay(MONDAY)).isTrue();
    }

    @Test
    void misconfiguredWindow_endNotAfterStart_suppresses() {
        when(settings.getLong(ConfigKeys.IPO_NOTIFY_WINDOW_END_HOUR)).thenReturn(10L); // == start
        assertThat(calendar.isNotificationWindow(MONDAY.atTime(12, 0))).isFalse();
    }

    @Test
    void endHour24_allowsLateEvening() {
        when(settings.getLong(ConfigKeys.IPO_NOTIFY_WINDOW_END_HOUR)).thenReturn(24L);
        assertThat(calendar.isNotificationWindow(MONDAY.atTime(23, 30))).isTrue();
    }
}
