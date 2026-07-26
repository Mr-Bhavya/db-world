package com.db.dbworld.app.ipo.source;

import com.db.dbworld.app.ipo.dto.IpoDto;
import com.db.dbworld.app.ipo.source.support.IpoHttpClient;
import com.db.dbworld.app.ipo.source.support.IpoHttpResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NseSourceTest {

    @Mock
    IpoHttpClient httpClient;

    private static final String HOME_URL = "https://www.nseindia.com/market-data/all-upcoming-issues-ipo";
    private static final String UPCOMING_URL = "https://www.nseindia.com/api/all-upcoming-issues?category=ipo";

    // Synthesized fixture matching the documented (provisional) top-level-array shape for the
    // "upcoming issues" endpoint.
    private static final String FIXTURE_UPCOMING = """
            [
              {
                "companyName": "Gamma Pharma Ltd",
                "symbol": "GAMMAPHARMA",
                "series": "EQ",
                "status": "Active",
                "issueStartDate": "21-Jul-2026",
                "issueEndDate": "23-Jul-2026",
                "issuePrice": "150"
              },
              {
                "companyName": "Delta Logistics Ltd",
                "symbol": "DELTALOG",
                "series": "EQ",
                "status": "Listed",
                "issueStartDate": "01-Jun-2026",
                "issueEndDate": "03-Jun-2026",
                "listingDate": "08-Jun-2026",
                "listingPrice": "212.50"
              }
            ]
            """;

    private static final String EMPTY_ARRAY = "[]";

    private NseSource newSource() {
        return new NseSource(httpClient);
    }

    private void stubHomeWithCookie() {
        HttpHeaders homeHeaders = new HttpHeaders();
        homeHeaders.add(HttpHeaders.SET_COOKIE, "nsit=abc123; Path=/; HttpOnly");
        homeHeaders.add(HttpHeaders.SET_COOKIE, "nseappid=xyz789; Path=/");
        when(httpClient.get(eq(HOME_URL), any())).thenReturn(new IpoHttpResponse("<html></html>", homeHeaders));
    }

    @Test
    void fetchAll_bootstrapsCookieThenMapsUpcomingEndpoint() {
        stubHomeWithCookie();
        when(httpClient.get(eq(UPCOMING_URL), any())).thenReturn(new IpoHttpResponse(FIXTURE_UPCOMING, new HttpHeaders()));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).hasSize(2);

        IpoDto gamma = result.get(0);
        assertThat(gamma.source()).isEqualTo("nse");
        assertThat(gamma.matchKey()).isNull();
        assertThat(gamma.companyName()).isEqualTo("Gamma Pharma Ltd");
        assertThat(gamma.ipoType()).isEqualTo("EQ");
        assertThat(gamma.status()).isEqualTo("Active");
        assertThat(gamma.openDate()).isEqualTo(LocalDate.of(2026, 7, 21));
        assertThat(gamma.closeDate()).isEqualTo(LocalDate.of(2026, 7, 23));
        assertThat(gamma.listingExchange()).isEqualTo("NSE");
        assertThat(gamma.priceMin()).isEqualByComparingTo("150");
        assertThat(gamma.priceMax()).isEqualByComparingTo("150");
        assertThat(gamma.listingPrice()).isNull();

        IpoDto delta = result.get(1);
        assertThat(delta.companyName()).isEqualTo("Delta Logistics Ltd");
        assertThat(delta.status()).isEqualTo("Listed");
        assertThat(delta.listingDate()).isEqualTo(LocalDate.of(2026, 6, 8));
        assertThat(delta.listingPrice()).isEqualByComparingTo("212.50");

        // The cookie captured from the bootstrap response must be forwarded on the data call.
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, String>> upcomingHeaders = ArgumentCaptor.forClass(Map.class);
        verify(httpClient).get(eq(UPCOMING_URL), upcomingHeaders.capture());
        assertThat(upcomingHeaders.getValue().get(HttpHeaders.COOKIE)).contains("nsit=abc123").contains("nseappid=xyz789");
    }

    @Test
    void fetchAll_companyNameFallsBackToSymbolWhenMissing() {
        stubHomeWithCookie();
        when(httpClient.get(eq(UPCOMING_URL), any())).thenReturn(new IpoHttpResponse("""
                [ { "symbol": "EPSILON", "status": "Active" } ]
                """, new HttpHeaders()));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).companyName()).isEqualTo("EPSILON");
    }

    @Test
    void fetchAll_bootstrapFails_returnsEmptyListWithoutCallingDataEndpoint() {
        when(httpClient.get(eq(HOME_URL), any())).thenThrow(new SourceFetchException("blocked"));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).isEmpty();
        verify(httpClient, never()).get(eq(UPCOMING_URL), any());
    }

    @Test
    void fetchAll_noCookiesReturned_returnsEmptyListWithoutCallingDataEndpoint() {
        when(httpClient.get(eq(HOME_URL), any()))
                .thenReturn(new IpoHttpResponse("<html></html>", new HttpHeaders()));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).isEmpty();
        verify(httpClient, never()).get(eq(UPCOMING_URL), any());
    }

    @Test
    void fetchAll_upcomingEndpointFails_returnsEmptyList() {
        stubHomeWithCookie();
        when(httpClient.get(eq(UPCOMING_URL), any())).thenThrow(new SourceFetchException("403"));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).isEmpty();
    }

    @Test
    void fetchAll_emptyUpcomingEndpoint_returnsEmptyList() {
        stubHomeWithCookie();
        when(httpClient.get(eq(UPCOMING_URL), any())).thenReturn(new IpoHttpResponse(EMPTY_ARRAY, new HttpHeaders()));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).isEmpty();
    }
}
