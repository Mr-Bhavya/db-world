package com.db.dbworld.app.ipo.notification;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.MonthDay;
import java.util.HashSet;
import java.util.Set;

/**
 * Decides whether the Indian IPO/market calendar allows a push notification to go out "now".
 * A send is allowed only during the configured IST quiet-hours window on a trading day — i.e. a
 * weekday that isn't a configured NSE holiday. This is the single gate {@link IpoNotificationService}
 * checks before every broadcast, so no IPO alert (open / listed / allotment / GMP / closing-soon)
 * ever fires overnight, on a weekend, or on a market holiday.
 *
 * <p>All inputs are runtime-editable via {@link SettingsService}:
 * <ul>
 *   <li>{@code ipo.notify.window-start-hour} / {@code ipo.notify.window-end-hour} — the inclusive
 *       start and exclusive end IST hours of the allowed window (defaults 10&nbsp;AM–9&nbsp;PM).</li>
 *   <li>{@code ipo.market.holidays} — comma-separated ISO dates (YYYY-MM-DD) treated as non-trading.</li>
 * </ul>
 * Reads are fail-safe (they fall back to catalog defaults), and a misconfigured window (end ≤ start)
 * suppresses rather than spams.
 */
@Log4j2
@Component
public class IpoMarketCalendar {

    private static final int MIN_HOUR = 0;
    private static final int MAX_HOUR = 24;

    private final SettingsService settings;

    /** Throttle for the "holiday list looks stale" warning — logged at most once per calendar day. */
    private volatile LocalDate lastStaleWarnOn;

    public IpoMarketCalendar(SettingsService settings) {
        this.settings = settings;
    }

    /** True when {@code nowIst} is a trading day AND falls inside the configured notification window. */
    public boolean isNotificationWindow(LocalDateTime nowIst) {
        LocalDate today = nowIst.toLocalDate();
        warnIfHolidayListStale(today); // only on the live gate path, where "today" is the real date
        return isTradingDay(today) && isWithinNotifyHours(nowIst.toLocalTime());
    }

    /**
     * A trading day = a weekday (Mon–Fri) that is not a configured NSE holiday. Pure predicate (no
     * side effects), so it's safe to reuse for working-day date math (e.g. deriving timeline dates).
     */
    public boolean isTradingDay(LocalDate date) {
        DayOfWeek dow = date.getDayOfWeek();
        if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) {
            return false;
        }
        return !holidays().contains(date);
    }

    /** Whether {@code time} is within [startHour, endHour) IST. Suppresses if the window is misconfigured. */
    private boolean isWithinNotifyHours(LocalTime time) {
        int startHour = clampHour((int) settings.getLong(ConfigKeys.IPO_NOTIFY_WINDOW_START_HOUR));
        int endHour = clampHour((int) settings.getLong(ConfigKeys.IPO_NOTIFY_WINDOW_END_HOUR));
        if (endHour <= startHour) {
            log.warn("IPO notify window misconfigured (start={} end={}) — suppressing sends", startHour, endHour);
            return false;
        }
        boolean afterStart = !time.isBefore(LocalTime.of(startHour, 0));
        // endHour == 24 means "to end of day"; LocalTime can't hold 24:00, so treat it as always-before.
        boolean beforeEnd = endHour == MAX_HOUR || time.isBefore(LocalTime.of(endHour, 0));
        return afterStart && beforeEnd;
    }

    private static int clampHour(int h) {
        return Math.max(MIN_HOUR, Math.min(MAX_HOUR, h));
    }

    /**
     * Parses the holiday config into exact dates ({@code YYYY-MM-DD}) and recurring month-days
     * ({@code MM-DD}, which apply every year so fixed-date holidays never go stale). The manual list
     * ({@code ipo.market.holidays}) is unioned with the yearly auto-fetched list
     * ({@code ipo.market.holidays.auto}). Unparseable tokens are logged and skipped.
     */
    private Holidays holidays() {
        Set<LocalDate> dates = new HashSet<>();
        Set<MonthDay> recurring = new HashSet<>();
        parseInto(settings.getString(ConfigKeys.IPO_MARKET_HOLIDAYS), dates, recurring);
        parseInto(settings.getString(ConfigKeys.IPO_MARKET_HOLIDAYS_AUTO), dates, recurring);
        return new Holidays(dates, recurring);
    }

    private void parseInto(String csv, Set<LocalDate> dates, Set<MonthDay> recurring) {
        if (csv == null || csv.isBlank()) {
            return;
        }
        for (String token : csv.split(",")) {
            String trimmed = token.trim();
            if (!trimmed.isEmpty()) {
                parseHolidayToken(trimmed, dates, recurring);
            }
        }
    }

    /** {@code YYYY-MM-DD} → one exact date; {@code MM-DD} → recurs every year. */
    private void parseHolidayToken(String token, Set<LocalDate> dates, Set<MonthDay> recurring) {
        String[] parts = token.split("-");
        try {
            if (parts.length == 3) {
                dates.add(LocalDate.of(Integer.parseInt(parts[0].trim()),
                        Integer.parseInt(parts[1].trim()), Integer.parseInt(parts[2].trim())));
            } else if (parts.length == 2) {
                recurring.add(MonthDay.of(Integer.parseInt(parts[0].trim()), Integer.parseInt(parts[1].trim())));
            } else {
                log.warn("Ignoring unparseable IPO market holiday '{}'", token);
            }
        } catch (RuntimeException e) {
            log.warn("Ignoring unparseable IPO market holiday '{}'", token);
        }
    }

    /**
     * Nudges the admin (WARN, at most once/day) when the exact-date holidays are all from a previous
     * year — i.e. the lunar-calendar NSE holidays haven't been refreshed for the current year. The
     * recurring {@code MM-DD} holidays and weekend handling keep working regardless.
     */
    private void warnIfHolidayListStale(LocalDate today) {
        if (today.equals(lastStaleWarnOn) || !holidays().hasExactDatesButNoneInYear(today.getYear())) {
            return;
        }
        lastStaleWarnOn = today;
        log.warn("IPO market-holiday list has no dated entries for {} — its year-specific NSE holidays "
                + "look stale. Update 'ipo.market.holidays' from the official {} NSE circular so lunar "
                + "holidays are honoured (recurring MM-DD holidays and weekends still apply).",
                today.getYear(), today.getYear());
    }

    /** Parsed holiday config: exact one-off dates plus month-days that recur every year. */
    private record Holidays(Set<LocalDate> dates, Set<MonthDay> recurring) {
        boolean contains(LocalDate date) {
            return dates.contains(date) || recurring.contains(MonthDay.from(date));
        }

        boolean hasExactDatesButNoneInYear(int year) {
            return !dates.isEmpty() && dates.stream().noneMatch(d -> d.getYear() == year);
        }
    }
}
