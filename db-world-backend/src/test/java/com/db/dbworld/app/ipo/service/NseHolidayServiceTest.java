package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.ipo.source.support.IpoHttpClient;
import com.db.dbworld.app.ipo.source.support.IpoHttpResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NseHolidayServiceTest {

    @Mock SettingsService settings;
    @Mock IpoHttpClient httpClient;

    // Fixed at 2026-08-10 IST → "current year" for the gate tests is 2026.
    private final Clock clock = Clock.fixed(Instant.parse("2026-08-10T06:00:00Z"), ZoneOffset.UTC);

    private NseHolidayService service() {
        return new NseHolidayService(settings, httpClient, clock);
    }

    @Test
    void parseCmHolidays_extractsEquitySegmentDatesOnly() {
        String json = """
            {
              "CM": [
                {"tradingDate":"26-Jan-2026","weekDay":"Monday","description":"Republic Day"},
                {"tradingDate":"03-Mar-2026","weekDay":"Tuesday","description":"Holi"}
              ],
              "FO": [
                {"tradingDate":"15-Aug-2026","weekDay":"Saturday","description":"Independence Day"}
              ]
            }
            """;
        assertThat(NseHolidayService.parseCmHolidays(json))
                .containsExactly(LocalDate.of(2026, 1, 26), LocalDate.of(2026, 3, 3)); // sorted, FO ignored
    }

    @Test
    void parseCmHolidays_skipsBadDatesAndToleratesMalformedBody() {
        String json = """
            {"CM":[{"tradingDate":"03-Mar-2026"},{"tradingDate":"not-a-date"},{"weekDay":"Monday"}]}
            """;
        assertThat(NseHolidayService.parseCmHolidays(json)).containsExactly(LocalDate.of(2026, 3, 3));
        assertThat(NseHolidayService.parseCmHolidays(")garbage(")).isEmpty();
        assertThat(NseHolidayService.parseCmHolidays("")).isEmpty();
    }

    @Test
    void refreshIfNeeded_skipsFetchWhenCurrentYearAlreadyStored() {
        when(settings.getString(ConfigKeys.IPO_MARKET_HOLIDAYS_AUTO)).thenReturn("2026-01-26,2026-12-25");

        service().refreshIfNeeded();

        verifyNoInteractions(httpClient);
        verify(settings, never()).update(any(), any(), any());
    }

    @Test
    void refreshIfNeeded_fetchesParsesAndStoresWhenCurrentYearMissing() {
        when(settings.getString(ConfigKeys.IPO_MARKET_HOLIDAYS_AUTO)).thenReturn(""); // nothing for 2026 yet

        String homeUrl = "https://www.nseindia.com/market-data/all-upcoming-issues-ipo";
        String holidayUrl = "https://www.nseindia.com/api/holiday-master?type=trading";

        HttpHeaders cookieHeaders = new HttpHeaders();
        cookieHeaders.add(HttpHeaders.SET_COOKIE, "nseappid=xyz; Path=/; HttpOnly");
        when(httpClient.get(eq(homeUrl), any())).thenReturn(new IpoHttpResponse("<html>ok</html>", cookieHeaders));
        when(httpClient.get(eq(holidayUrl), any())).thenReturn(new IpoHttpResponse(
                "{\"CM\":[{\"tradingDate\":\"26-Jan-2026\"},{\"tradingDate\":\"03-Mar-2026\"}]}",
                new HttpHeaders()));

        service().refreshIfNeeded();

        verify(settings).update(ConfigKeys.IPO_MARKET_HOLIDAYS_AUTO, "2026-01-26,2026-03-03", "system-nse-holiday-sync");
    }

    @Test
    void refreshIfNeeded_bootstrapWithoutCookie_storesNothing() {
        when(settings.getString(ConfigKeys.IPO_MARKET_HOLIDAYS_AUTO)).thenReturn("");
        // Home response carries no Set-Cookie → the anti-bot bootstrap fails → no store, no throw.
        when(httpClient.get(any(), any())).thenReturn(new IpoHttpResponse("<html>", new HttpHeaders()));

        service().refreshIfNeeded();

        verify(settings, never()).update(any(), any(), any());
    }
}
