package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.ipo.source.support.IpoHttpClient;
import com.db.dbworld.app.ipo.source.support.IpoHttpResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

/**
 * Keeps the NSE market-holiday list current with ZERO manual upkeep: once a year it fetches NSE's
 * official trading-holiday feed and stores the equity-segment dates in {@code ipo.market.holidays.auto},
 * which {@link com.db.dbworld.app.ipo.notification.IpoMarketCalendar} unions with the admin's manual
 * {@code ipo.market.holidays} list. Called each poll cycle by {@code IpoPollScheduler} via
 * {@link #refreshIfNeeded()} — a no-op once the current year is already stored.
 *
 * <p>Best-effort by design: NSE blocks non-browser clients (same anti-bot dance as {@link
 * com.db.dbworld.app.ipo.source.NseSource} — bootstrap a page for cookies, then replay them). ANY
 * failure just leaves the existing list untouched and retries on a later day; it never throws, so a
 * holiday-sync hiccup can't affect the poll. The recurring {@code MM-DD} fixed holidays and weekend
 * handling keep working regardless.
 */
@Log4j2
@Component
public class NseHolidayService {

    private static final String DEFAULT_BASE_URL = "https://www.nseindia.com";
    private static final String HOME_PATH = "/market-data/all-upcoming-issues-ipo";
    private static final String HOLIDAY_PATH = "/api/holiday-master?type=trading";
    /** Capital-Market (equity) segment — the one that matters for IPO open/list/close days. */
    private static final String SEGMENT_CM = "CM";
    private static final String F_TRADING_DATE = "tradingDate";

    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    private static final String ACCEPT = "application/json, text/plain, */*";

    /** NSE reports holiday dates as e.g. "26-Jan-2026". */
    private static final DateTimeFormatter NSE_DATE = DateTimeFormatter.ofPattern("dd-MMM-yyyy", Locale.ENGLISH);
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final SettingsService settings;
    private final IpoHttpClient httpClient;
    private final Clock clock;

    /** Throttle so a persistently-failing fetch is retried at most once per day, not every poll. */
    private volatile LocalDate lastAttemptedOn;

    @Autowired
    public NseHolidayService(SettingsService settings, IpoHttpClient httpClient) {
        this(settings, httpClient, Clock.systemUTC());
    }

    NseHolidayService(SettingsService settings, IpoHttpClient httpClient, Clock clock) {
        this.settings = settings;
        this.httpClient = httpClient;
        this.clock = clock;
    }

    /**
     * Fetch + store this year's NSE holidays if they aren't already stored. Gated to do real work at
     * most once a day, and only until the current year is captured. Never throws.
     */
    public void refreshIfNeeded() {
        try {
            LocalDate today = LocalDate.now(clock.withZone(IST));
            if (hasAutoHolidaysForYear(today.getYear()) || today.equals(lastAttemptedOn)) {
                return;
            }
            lastAttemptedOn = today;
            Set<LocalDate> fetched = fetchTradingHolidays();
            if (fetched.isEmpty()) {
                log.warn("NSE holiday sync: fetch returned no dates — keeping existing list, will retry another day");
                return;
            }
            String csv = fetched.stream().map(LocalDate::toString).collect(Collectors.joining(","));
            settings.update(ConfigKeys.IPO_MARKET_HOLIDAYS_AUTO, csv, "system-nse-holiday-sync");
            log.info("NSE holiday sync: stored {} trading holiday(s) into the auto list", fetched.size());
        } catch (Exception e) {
            log.warn("NSE holiday sync failed (best-effort, ignored): {}", e.toString());
        }
    }

    /** Whether the stored auto list already contains at least one date in {@code year}. */
    private boolean hasAutoHolidaysForYear(int year) {
        String csv = settings.getString(ConfigKeys.IPO_MARKET_HOLIDAYS_AUTO);
        if (csv == null || csv.isBlank()) {
            return false;
        }
        for (String token : csv.split(",")) {
            try {
                if (LocalDate.parse(token.trim()).getYear() == year) {
                    return true;
                }
            } catch (DateTimeParseException ignored) {
                // skip an unparseable stored token
            }
        }
        return false;
    }

    /** Bootstrap NSE session cookies then GET the holiday feed; empty set on any failure. */
    Set<LocalDate> fetchTradingHolidays() {
        try {
            String homeUrl = baseUrl() + HOME_PATH;
            IpoHttpResponse home = httpClient.get(homeUrl, browserHeaders(null));
            String cookie = buildCookieHeader(home.header(HttpHeaders.SET_COOKIE));
            if (cookie == null || cookie.isBlank()) {
                log.warn("NSE holiday sync: bootstrap returned no session cookie");
                return Set.of();
            }
            Map<String, String> headers = browserHeaders(homeUrl);
            headers.put(HttpHeaders.COOKIE, cookie);
            IpoHttpResponse response = httpClient.get(baseUrl() + HOLIDAY_PATH, headers);
            return parseCmHolidays(response.body());
        } catch (Exception e) {
            log.warn("NSE holiday fetch failed (likely anti-bot block or upstream change): {}", e.toString());
            return Set.of();
        }
    }

    /**
     * Parses the equity ({@code CM}) segment of NSE's holiday-master JSON into a set of dates. Pure +
     * static so it's unit-testable without a live call. Other segments (FO/CD/…) and unparseable dates
     * are ignored; a malformed body yields an empty set (never throws).
     */
    static Set<LocalDate> parseCmHolidays(String body) {
        Set<LocalDate> dates = new TreeSet<>();
        if (body == null || body.isBlank()) {
            return dates;
        }
        try {
            JsonNode root = MAPPER.readTree(body);
            for (JsonNode entry : root.path(SEGMENT_CM)) {
                String raw = entry.path(F_TRADING_DATE).asText(null);
                if (raw == null || raw.isBlank()) {
                    continue;
                }
                try {
                    dates.add(LocalDate.parse(raw.trim(), NSE_DATE));
                } catch (DateTimeParseException ignored) {
                    // skip an unparseable date token
                }
            }
        } catch (Exception e) {
            log.warn("NSE holiday parse failed: {}", e.toString());
        }
        return dates;
    }

    /** Configured NSE base URL (shared with NseSource), trailing slash trimmed. */
    private String baseUrl() {
        String configured = settings.getString(ConfigKeys.IPO_NSE_BASE_URL);
        String base = (configured == null || configured.isBlank()) ? DEFAULT_BASE_URL : configured.trim();
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    private static Map<String, String> browserHeaders(String referer) {
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put(HttpHeaders.USER_AGENT, USER_AGENT);
        headers.put(HttpHeaders.ACCEPT, ACCEPT);
        if (referer != null) {
            headers.put(HttpHeaders.REFERER, referer);
        }
        return headers;
    }

    /** Extracts the {@code name=value} pair from each Set-Cookie header and joins them for reuse. */
    private static String buildCookieHeader(List<String> setCookieHeaders) {
        if (setCookieHeaders == null || setCookieHeaders.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (String setCookie : setCookieHeaders) {
            if (setCookie == null || setCookie.isBlank()) {
                continue;
            }
            int idx = setCookie.indexOf(';');
            String pair = (idx >= 0 ? setCookie.substring(0, idx) : setCookie).trim();
            if (pair.isEmpty()) {
                continue;
            }
            if (!sb.isEmpty()) {
                sb.append("; ");
            }
            sb.append(pair);
        }
        return sb.isEmpty() ? null : sb.toString();
    }
}
