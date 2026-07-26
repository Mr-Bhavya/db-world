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
    private static final String CURRENT_URL = "https://www.nseindia.com/api/ipo-current-issue";
    private static final String UPCOMING_URL = "https://www.nseindia.com/api/all-upcoming-issues?category=ipo";
    private static final String XTRANET_DETAIL_URL = "https://www.nseindia.com/api/ipo-detail?symbol=XTRANET&series=EQ";

    private static final String EMPTY_ARRAY = "[]";

    // Real ipo-current-issue row (captured from DevTools): a currently-open issue with the overall
    // live subscription multiple in noOfTime and a "Rs.X to Rs.Y" price band.
    private static final String FIXTURE_CURRENT_XTRANET = """
            [
              {
                "companyName": "Xtranet Technologies Limited",
                "issueEndDate": "27-Jul-2026",
                "issuePrice": "Rs.120 to Rs.127",
                "issueSize": "9193800",
                "issueStartDate": "23-Jul-2026",
                "series": "EQ",
                "status": "Active",
                "symbol": "XTRANET",
                "category": "Total",
                "noOfTime": "1.3055754965302704",
                "srNo": null
              }
            ]
            """;

    // Real ipo-detail response (trimmed): bidDetails carries the top-level QIB/NII/Retail/Total rows
    // (keyed by srNo "1"/"2"/"3"/null) plus sub-rows ("1(a)", "2.1") that must be ignored;
    // issueInfo.dataList carries Price Range / Face Value / Bid Lot / Name of the Registrar (and an
    // Address of the Registrar that must NOT be mistaken for the registrar name).
    private static final String FIXTURE_DETAIL_XTRANET = """
            {
              "companyName": "XTRANET",
              "bidDetails": [
                {"category": "Qualified Institutional Buyers(QIBs)", "noOfTime": "0.45720268006700165", "srNo": "1"},
                {"category": "Foreign Institutional Investors(FIIs)", "noOfTime": "", "srNo": "1(a)"},
                {"category": "Non Institutional Investors", "noOfTime": "1.559575656058068", "srNo": "2"},
                {"category": "Non Institutional Investors(Bid > 10L)", "noOfTime": "1.345896147403685", "srNo": "2.1"},
                {"category": "Retail Individual Investors(RIIs)", "noOfTime": "1.6815027518545107", "srNo": "3"},
                {"category": "Total", "noOfSharesOffered": "9193800.0", "noOfTime": "1.3055754965302704", "srNo": null}
              ],
              "issueInfo": {
                "dataList": [
                  {"title": "Symbol", "value": "XTRANET"},
                  {"title": "Price Range", "value": "Rs. 120 to Rs. 127 per Equity Share"},
                  {"title": "Face Value", "value": "Rs.10 per Equity Share"},
                  {"title": "Bid Lot", "value": "Minimum 110 Equity shares and in multiples thereof"},
                  {"title": "Name of the Registrar", "value": "Kfin Technologies Limited"},
                  {"title": "Address of the Registrar", "value": "Selenium, Tower B, Plot No. 31 and 32, Hyderabad"}
                ],
                "symbol": "XTRANET"
              }
            }
            """;

    // Real all-upcoming-issues shape: same field names as ipo-current-issue, minus the subscription.
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

    private NseSource newSource() {
        return new NseSource(httpClient);
    }

    private void stubHomeWithCookie() {
        HttpHeaders homeHeaders = new HttpHeaders();
        homeHeaders.add(HttpHeaders.SET_COOKIE, "nsit=abc123; Path=/; HttpOnly");
        homeHeaders.add(HttpHeaders.SET_COOKIE, "nseappid=xyz789; Path=/");
        when(httpClient.get(eq(HOME_URL), any())).thenReturn(new IpoHttpResponse("<html></html>", homeHeaders));
    }

    private void stubResponse(String url, String body) {
        when(httpClient.get(eq(url), any())).thenReturn(new IpoHttpResponse(body, new HttpHeaders()));
    }

    // ── Current (open) issues ───────────────────────────────────────────────────────────────────

    @Test
    void fetchAll_mapsCurrentOpenIssueWithSubscriptionTotal() {
        stubHomeWithCookie();
        stubResponse(CURRENT_URL, FIXTURE_CURRENT_XTRANET);
        stubResponse(XTRANET_DETAIL_URL, "{}"); // detail present but empty → enrichment is a clean no-op
        stubResponse(UPCOMING_URL, EMPTY_ARRAY);

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).hasSize(1);
        IpoDto xtranet = result.get(0);
        assertThat(xtranet.source()).isEqualTo("nse");
        assertThat(xtranet.matchKey()).isNull();
        assertThat(xtranet.companyName()).isEqualTo("Xtranet Technologies Limited");
        assertThat(xtranet.tickerSymbol()).isEqualTo("XTRANET");
        assertThat(xtranet.ipoType()).isEqualTo("EQ"); // raw series; ingest canonicalizes → mainboard
        assertThat(xtranet.status()).isEqualTo("Active");
        assertThat(xtranet.openDate()).isEqualTo(LocalDate.of(2026, 7, 23));
        assertThat(xtranet.closeDate()).isEqualTo(LocalDate.of(2026, 7, 27));
        assertThat(xtranet.priceMin()).isEqualByComparingTo("120");
        assertThat(xtranet.priceMax()).isEqualByComparingTo("127");
        assertThat(xtranet.subTotal()).isEqualByComparingTo("1.3055754965302704"); // overall live subscription
        assertThat(xtranet.listingExchange()).isEqualTo("NSE");

        // The cookie captured from the bootstrap response must be forwarded on the data call.
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, String>> currentHeaders = ArgumentCaptor.forClass(Map.class);
        verify(httpClient).get(eq(CURRENT_URL), currentHeaders.capture());
        assertThat(currentHeaders.getValue().get(HttpHeaders.COOKIE)).contains("nsit=abc123").contains("nseappid=xyz789");
    }

    @Test
    void fetchAll_enrichesOpenIssueFromDetailPage() {
        stubHomeWithCookie();
        stubResponse(CURRENT_URL, FIXTURE_CURRENT_XTRANET);
        stubResponse(XTRANET_DETAIL_URL, FIXTURE_DETAIL_XTRANET);
        stubResponse(UPCOMING_URL, EMPTY_ARRAY);

        IpoDto xtranet = newSource().fetchAll().get(0);

        // Per-category subscription from bidDetails — only the top-level QIB/NII/Retail rows, never
        // the "2.1"-style sub-rows or the "1(a)" FII line.
        assertThat(xtranet.subscriptionCategories()).containsOnlyKeys("QIB", "NII", "Retail");
        assertThat(xtranet.subscriptionCategories().get("QIB")).isEqualByComparingTo("0.45720268006700165");
        assertThat(xtranet.subscriptionCategories().get("NII")).isEqualByComparingTo("1.559575656058068");
        assertThat(xtranet.subscriptionCategories().get("Retail")).isEqualByComparingTo("1.6815027518545107");
        assertThat(xtranet.subTotal()).isEqualByComparingTo("1.3055754965302704"); // the Total (srNo null) row

        // issueInfo.dataList enrichment.
        assertThat(xtranet.faceValue()).isEqualByComparingTo("10");
        assertThat(xtranet.lotSize()).isEqualTo(110);
        assertThat(xtranet.registrar()).isEqualTo("Kfin Technologies Limited"); // NOT the Address row
        assertThat(xtranet.priceMin()).isEqualByComparingTo("120");
        assertThat(xtranet.priceMax()).isEqualByComparingTo("127");
    }

    @Test
    void fetchAll_detailFetchFails_keepsCoreOpenIssueData() {
        stubHomeWithCookie();
        stubResponse(CURRENT_URL, FIXTURE_CURRENT_XTRANET);
        when(httpClient.get(eq(XTRANET_DETAIL_URL), any())).thenThrow(new SourceFetchException("403"));
        stubResponse(UPCOMING_URL, EMPTY_ARRAY);

        IpoDto xtranet = newSource().fetchAll().get(0);

        assertThat(xtranet.companyName()).isEqualTo("Xtranet Technologies Limited");
        assertThat(xtranet.subTotal()).isEqualByComparingTo("1.3055754965302704"); // kept from the current-issue row
        assertThat(xtranet.subscriptionCategories()).isNull();
        assertThat(xtranet.faceValue()).isNull();
        assertThat(xtranet.lotSize()).isNull();
        assertThat(xtranet.registrar()).isNull();
    }

    // ── Upcoming issues ─────────────────────────────────────────────────────────────────────────

    @Test
    void fetchAll_mapsUpcomingIssues() {
        stubHomeWithCookie();
        stubResponse(CURRENT_URL, EMPTY_ARRAY);
        stubResponse(UPCOMING_URL, FIXTURE_UPCOMING);

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).hasSize(2);

        IpoDto gamma = result.get(0);
        assertThat(gamma.companyName()).isEqualTo("Gamma Pharma Ltd");
        assertThat(gamma.tickerSymbol()).isEqualTo("GAMMAPHARMA");
        assertThat(gamma.ipoType()).isEqualTo("EQ");
        assertThat(gamma.status()).isEqualTo("Active");
        assertThat(gamma.openDate()).isEqualTo(LocalDate.of(2026, 7, 21));
        assertThat(gamma.closeDate()).isEqualTo(LocalDate.of(2026, 7, 23));
        assertThat(gamma.listingExchange()).isEqualTo("NSE");
        assertThat(gamma.priceMin()).isEqualByComparingTo("150"); // single value → fixed-price band
        assertThat(gamma.priceMax()).isEqualByComparingTo("150");
        assertThat(gamma.subTotal()).isNull(); // upcoming issues have no live subscription

        IpoDto delta = result.get(1);
        assertThat(delta.companyName()).isEqualTo("Delta Logistics Ltd");
        assertThat(delta.status()).isEqualTo("Listed");
        assertThat(delta.listingDate()).isEqualTo(LocalDate.of(2026, 6, 8));
        assertThat(delta.listingPrice()).isEqualByComparingTo("212.50");

        // Upcoming rows are never enriched from the detail page.
        verify(httpClient, never()).get(eq(XTRANET_DETAIL_URL), any());
    }

    @Test
    void fetchAll_companyNameFallsBackToSymbolWhenMissing() {
        stubHomeWithCookie();
        stubResponse(CURRENT_URL, EMPTY_ARRAY);
        stubResponse(UPCOMING_URL, "[ { \"symbol\": \"EPSILON\", \"status\": \"Active\" } ]");

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).companyName()).isEqualTo("EPSILON");
    }

    // ── Bootstrap / failure handling ─────────────────────────────────────────────────────────────

    @Test
    void fetchAll_bootstrapFails_returnsEmptyListWithoutCallingDataEndpoints() {
        when(httpClient.get(eq(HOME_URL), any())).thenThrow(new SourceFetchException("blocked"));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).isEmpty();
        verify(httpClient, never()).get(eq(CURRENT_URL), any());
        verify(httpClient, never()).get(eq(UPCOMING_URL), any());
    }

    @Test
    void fetchAll_noCookiesReturned_returnsEmptyListWithoutCallingDataEndpoints() {
        when(httpClient.get(eq(HOME_URL), any()))
                .thenReturn(new IpoHttpResponse("<html></html>", new HttpHeaders()));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).isEmpty();
        verify(httpClient, never()).get(eq(CURRENT_URL), any());
        verify(httpClient, never()).get(eq(UPCOMING_URL), any());
    }

    @Test
    void fetchAll_upcomingEndpointFails_stillReturnsOpenIssues() {
        stubHomeWithCookie();
        stubResponse(CURRENT_URL, FIXTURE_CURRENT_XTRANET);
        stubResponse(XTRANET_DETAIL_URL, "{}");
        when(httpClient.get(eq(UPCOMING_URL), any())).thenThrow(new SourceFetchException("403"));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).companyName()).isEqualTo("Xtranet Technologies Limited");
    }

    @Test
    void fetchAll_bothEndpointsEmpty_returnsEmptyList() {
        stubHomeWithCookie();
        stubResponse(CURRENT_URL, EMPTY_ARRAY);
        stubResponse(UPCOMING_URL, EMPTY_ARRAY);

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).isEmpty();
    }
}
