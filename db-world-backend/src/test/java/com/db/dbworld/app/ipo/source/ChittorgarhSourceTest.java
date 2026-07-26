package com.db.dbworld.app.ipo.source;

import com.db.dbworld.app.ipo.dto.IpoDto;
import com.db.dbworld.app.ipo.dto.IpoFinancialRowDto;
import com.db.dbworld.app.ipo.source.support.IpoHttpClient;
import com.db.dbworld.app.ipo.source.support.IpoHttpResponse;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChittorgarhSourceTest {

    @Mock
    IpoHttpClient httpClient;

    // Fixed "now" so the FY-based list URL and the recent-listing enrichment gate are deterministic:
    // 24-Jul-2026 (IST) → financial year 2026-27, same reference date used elsewhere in the suite.
    private static final Instant NOW = Instant.parse("2026-07-24T10:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    private static final String LIST_URL_PAGE1 =
            "https://webnodejs.chittorgarh.com/cloud/report/data-read/82/1/7/2026/2026-27/0/all";
    private static final String LIST_URL_PAGE2 =
            "https://webnodejs.chittorgarh.com/cloud/report/data-read/82/2/7/2026/2026-27/0/all";

    private ChittorgarhSource newSource() {
        return new ChittorgarhSource(httpClient, CLOCK);
    }

    // Synthesized list-JSON fixture matching the REAL webnodejs response shape (captured from the
    // browser DevTools Network tab): the "Company" cell is an HTML anchor (name + absolute detail
    // href), dates are "dd-MMM-yyyy", weird JSON key casing verbatim ("...reservations) (Rs.cr.)",
    // "Offer for sale (Rs.cr.)", "Listing at"), plus the ~-prefixed fields (~compare_image logo,
    // ~nse_symbol / ~bse_script_code ticker). Row 1 = a real SME fixed-price row; row 2 = a real SME
    // row with an NSE symbol; row 3 = a synthesized mainboard band row listing on both exchanges.
    private static final String FIXTURE_JSON = """
            {
              "reportTableData": [
                {
                  "Company": "<a href=\\"https://www.chittorgarh.com/ipo/modern-diagnostic-ipo/2276/\\" title=\\"Modern Diagnostic IPO Details\\">Modern Diagnostic & Research Centre Ltd.</a> ",
                  "Issue Category": "SME",
                  "Pricing Method": "Bookbuilding",
                  "Opening Date": "31-Dec-2025",
                  "Closing Date": "02-Jan-2026",
                  "Listing Date": "07-Jan-2026",
                  "Issue Price (Rs.)": "90.00",
                  "Total Issue Amount (Incl.Firm reservations) (Rs.cr.)": "36.89",
                  "Fresh Capital (Rs.cr.)": "35.04",
                  "Offer for sale (Rs.cr.)": "",
                  "Listing at": "BSE SME",
                  "~compare_image": "https://www.chittorgarh.net/images/ipo/modern-diagnostic-ipo-logo.jpg",
                  "~nse_symbol": "",
                  "~bse_script_code": 544673
                },
                {
                  "Company": "<a href=\\"https://www.chittorgarh.com/ipo/e-to-e-transportation-infrastructure-ipo/2720/\\">E to E Transportation Infrastructure Ltd.</a> ",
                  "Issue Category": "SME",
                  "Opening Date": "26-Dec-2025",
                  "Closing Date": "30-Dec-2025",
                  "Listing Date": "02-Jan-2026",
                  "Issue Price (Rs.)": "174.00",
                  "Total Issue Amount (Incl.Firm reservations) (Rs.cr.)": "84.22",
                  "Fresh Capital (Rs.cr.)": "79.97",
                  "Offer for sale (Rs.cr.)": "",
                  "Listing at": "NSE SME",
                  "~compare_image": "https://www.chittorgarh.net/images/ipo/e-to-e-transportation-logo.png",
                  "~nse_symbol": "E2ERAIL",
                  "~bse_script_code": ""
                },
                {
                  "Company": "<a href=\\"https://www.chittorgarh.com/ipo/beta-textiles-ipo/999/\\">Beta Textiles Ltd</a>",
                  "Issue Category": "Mainboard",
                  "Opening Date": "05-Aug-2026",
                  "Closing Date": "07-Aug-2026",
                  "Listing Date": "",
                  "Issue Price (Rs.)": "120.00 to 127.00",
                  "Total Issue Amount (Incl.Firm reservations) (Rs.cr.)": "1,800.00",
                  "Fresh Capital (Rs.cr.)": "",
                  "Offer for sale (Rs.cr.)": "",
                  "Listing at": "BSE, NSE",
                  "~compare_image": "",
                  "~nse_symbol": "",
                  "~bse_script_code": ""
                }
              ],
              "totalRecords": 3,
              "totalPages": 1
            }
            """;

    private static final String BETA_DETAIL_URL = "https://www.chittorgarh.com/ipo/beta-textiles-ipo/999/";

    @Test
    void parseList_mapsSmeFixedPriceRow() {
        List<IpoDto> result = newSource().parseList(FIXTURE_JSON);

        assertThat(result).hasSize(3);

        IpoDto modern = result.get(0);
        assertThat(modern.source()).isEqualTo("chittorgarh");
        assertThat(modern.matchKey()).isNull();
        assertThat(modern.companyName()).isEqualTo("Modern Diagnostic & Research Centre Ltd."); // anchor text, entity-decoded
        assertThat(modern.ipoType()).isEqualTo("SME"); // raw "Issue Category"; ingest canonicalizes
        assertThat(modern.status()).isNull();          // not in the list JSON
        assertThat(modern.openDate()).isEqualTo(LocalDate.of(2025, 12, 31));
        assertThat(modern.closeDate()).isEqualTo(LocalDate.of(2026, 1, 2));
        assertThat(modern.listingDate()).isEqualTo(LocalDate.of(2026, 1, 7));
        assertThat(modern.priceMin()).isEqualByComparingTo("90.00"); // single value → fixed-price band
        assertThat(modern.priceMax()).isEqualByComparingTo("90.00");
        assertThat(modern.issueSize()).isEqualTo("₹36.89 Cr");
        assertThat(modern.freshIssue()).isEqualByComparingTo("35.04");
        assertThat(modern.offerForSale()).isNull();    // blank cell
        assertThat(modern.listingExchange()).isEqualTo("BSE"); // "BSE SME" → BSE, SME suffix ignored
        assertThat(modern.logoUrl()).isEqualTo("https://www.chittorgarh.net/images/ipo/modern-diagnostic-ipo-logo.jpg");
        assertThat(modern.tickerSymbol()).isEqualTo("544673"); // no NSE symbol → BSE scrip code
        assertThat(modern.registrar()).isNull();       // "Left Lead Manager" is NOT the registrar (and not mapped)
    }

    @Test
    void parseList_mapsNseSymbolAsTicker() {
        IpoDto eToE = newSource().parseList(FIXTURE_JSON).get(1);

        assertThat(eToE.companyName()).isEqualTo("E to E Transportation Infrastructure Ltd.");
        assertThat(eToE.priceMin()).isEqualByComparingTo("174.00"); // single value → fixed-price band
        assertThat(eToE.priceMax()).isEqualByComparingTo("174.00");
        assertThat(eToE.listingExchange()).isEqualTo("NSE"); // "NSE SME" → NSE
        assertThat(eToE.tickerSymbol()).isEqualTo("E2ERAIL"); // NSE symbol wins over BSE code
    }

    @Test
    void parseList_mapsMainboardBandRow() {
        IpoDto beta = newSource().parseList(FIXTURE_JSON).get(2);

        assertThat(beta.companyName()).isEqualTo("Beta Textiles Ltd");
        assertThat(beta.ipoType()).isEqualTo("Mainboard");
        assertThat(beta.openDate()).isEqualTo(LocalDate.of(2026, 8, 5));
        assertThat(beta.closeDate()).isEqualTo(LocalDate.of(2026, 8, 7));
        assertThat(beta.listingDate()).isNull();        // blank cell
        assertThat(beta.priceMin()).isEqualByComparingTo("120.00");
        assertThat(beta.priceMax()).isEqualByComparingTo("127.00");
        assertThat(beta.issueSize()).isEqualTo("₹1,800.00 Cr"); // comma thousands kept in the label
        assertThat(beta.freshIssue()).isNull();         // blank cell
        assertThat(beta.offerForSale()).isNull();       // blank cell
        assertThat(beta.listingExchange()).isEqualTo("BOTH"); // "BSE, NSE" → BOTH
        assertThat(beta.logoUrl()).isNull();            // blank ~compare_image
        assertThat(beta.tickerSymbol()).isNull();       // both ticker fields blank (still upcoming)
    }

    @Test
    void parseList_zeroPricePlaceholder_yieldsNullBand() {
        String json = """
                {"reportTableData":[
                  {"Company":"<a href=\\"https://x/ipo/z/1/\\">Not Yet Priced Co</a>","Issue Price (Rs.)":"0.00 to 0.00"}
                ],"totalPages":1}
                """;

        IpoDto dto = newSource().parseList(json).get(0);

        assertThat(dto.priceMin()).isNull();
        assertThat(dto.priceMax()).isNull();
    }

    @Test
    void parseList_noReportDataArray_returnsEmptyList() {
        assertThat(newSource().parseList("{\"msg\":1}")).isEmpty();
    }

    @Test
    void parseList_malformedJson_returnsEmptyList() {
        assertThat(newSource().parseList("not json")).isEmpty();
    }

    @Test
    void fetchAll_delegatesToJsonEndpointAndParsesResult() {
        when(httpClient.get(eq(LIST_URL_PAGE1), any()))
                .thenReturn(new IpoHttpResponse(FIXTURE_JSON, new HttpHeaders()));
        // Beta (no listing date) is enrichment-eligible; stub its detail page as section-less HTML
        // so enrichment is a clean no-op. Modern/E-to-E listed in Jan 2026 → gated out (old).
        when(httpClient.get(eq(BETA_DETAIL_URL), any()))
                .thenReturn(new IpoHttpResponse("<html><body></body></html>", new HttpHeaders()));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).hasSize(3);
        assertThat(result.get(0).companyName()).isEqualTo("Modern Diagnostic & Research Centre Ltd.");
        verify(httpClient, never()).get(eq(LIST_URL_PAGE2), any()); // totalPages=1 → no second page
    }

    @Test
    void fetchAll_httpClientThrows_returnsEmptyList() {
        when(httpClient.get(eq(LIST_URL_PAGE1), any())).thenThrow(new SourceFetchException("blocked"));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).isEmpty();
    }

    @Test
    void fetchAll_walksMultiplePagesWhenTotalPagesGreaterThanOne() {
        String page1 = """
                {"reportTableData":[
                  {"Company":"<a href=\\"https://x/ipo/a/1/\\">Page One Co</a>","Issue Category":"Mainboard","Listing Date":"01-Jan-2026"}
                ],"totalPages":2}
                """;
        String page2 = """
                {"reportTableData":[
                  {"Company":"<a href=\\"https://x/ipo/b/2/\\">Page Two Co</a>","Issue Category":"Mainboard","Listing Date":"01-Jan-2026"}
                ],"totalPages":2}
                """;
        when(httpClient.get(eq(LIST_URL_PAGE1), any())).thenReturn(new IpoHttpResponse(page1, new HttpHeaders()));
        when(httpClient.get(eq(LIST_URL_PAGE2), any())).thenReturn(new IpoHttpResponse(page2, new HttpHeaders()));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).companyName()).isEqualTo("Page One Co");
        assertThat(result.get(1).companyName()).isEqualTo("Page Two Co");
        verify(httpClient).get(eq(LIST_URL_PAGE1), any());
        verify(httpClient).get(eq(LIST_URL_PAGE2), any());
    }

    // ── Detail-page enrichment (About/Strengths/Financials) — parsed from the detail page's REAL
    // server-rendered DOM (captured live, Xtranet 2688): About + Competitive-Strengths live under
    // the stable #ipoSummary id, and the "Company Financials" table (#financialTable) is TRANSPOSED
    // — metrics down the first column, fiscal periods across the header. No risks section exists. ─

    private static final String DETAIL_URL = "https://www.chittorgarh.com/ipo/acme-robotics/123/";

    // A one-row list JSON whose anchor points at DETAIL_URL and has no listing date (enrichment-eligible).
    private static final String ACME_LIST_JSON = """
            {"reportTableData":[
              {"Company":"<a href=\\"https://www.chittorgarh.com/ipo/acme-robotics/123/\\">Acme Robotics Ltd</a>",
               "Issue Category":"SME","Opening Date":"31-Jul-2026","Closing Date":"04-Aug-2026","Listing Date":""}
            ],"totalPages":1}
            """;

    // Detail-page fixture mirroring the real DOM: #ipoSummary (intro paragraphs → about, the
    // "Competitive Strengths" <ul> → strengths) and the transposed #financialTable.
    private static final String DETAIL_FIXTURE_HTML = """
            <html><body>
            <div id="about-company-section" class="row">
              <div class="col-md-12 ipo-summary">
                <h2 class="section-title">About Acme Robotics Ltd.</h2>
                <div id="ipoSummary" class="collapse">
                  <p>Incorporated in 2002, Acme Robotics designs and manufactures industrial robotics for the automotive sector.</p>
                  <p>It has a pan-India distribution network.</p>
                  <p><strong>Competitive Strengths</strong></p>
                  <ul>
                    <li>Strong industrial robotics portfolio</li>
                    <li>Established automotive OEM relationships</li>
                  </ul>
                </div>
              </div>
            </div>
            <div class="col-12">
              <h2 itemProp="about">Company Financials (Restated Consolidated)</h2>
              <div class="table-responsive">
                <table id="financialTable">
                  <thead>
                    <tr><th>Period Ended</th><th class="text-end">31 Mar 2026</th><th class="text-end">31 Mar 2025</th><th class="text-end">31 Mar 2024</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Assets</td><td class="text-end">341.97</td><td class="text-end">321.79</td><td class="text-end">202.94</td></tr>
                    <tr><td>Total Income</td><td class="text-end">366.01</td><td class="text-end">276.53</td><td class="text-end">233.26</td></tr>
                    <tr><td>Profit After Tax</td><td class="text-end">40.73</td><td class="text-end">30.03</td><td class="text-end">10.94</td></tr>
                    <tr><td>EBITDA</td><td class="text-end">63.18</td><td class="text-end">47.20</td><td class="text-end">18.86</td></tr>
                    <tr><td>NET Worth</td><td class="text-end">136.01</td><td class="text-end">95.49</td><td class="text-end">38.78</td></tr>
                    <tr><td>Total Borrowing</td><td class="text-end">85.45</td><td class="text-end">39.24</td><td class="text-end">41.19</td></tr>
                  </tbody>
                  <tfoot><tr><td colspan="4">Amount in ₹Crore</td></tr></tfoot>
                </table>
              </div>
            </div>
            </body></html>
            """;

    @Test
    void parseDetail_extractsAboutStrengthsAndTransposedFinancials() {
        Document doc = Jsoup.parse(DETAIL_FIXTURE_HTML, DETAIL_URL);

        ChittorgarhSource.DetailEnrichment enrichment = newSource().parseDetail(doc);

        assertThat(enrichment.about())
                .contains("Incorporated in 2002")
                .contains("pan-India distribution network")
                .doesNotContain("Competitive Strengths")     // strengths label + list excluded from about
                .doesNotContain("Strong industrial robotics portfolio");
        assertThat(enrichment.strengths())
                .isEqualTo("Strong industrial robotics portfolio\nEstablished automotive OEM relationships");
        assertThat(enrichment.risks()).isNull();              // no risks section on the detail page

        // Transposed table → one row per fiscal period, Total Income→revenue, PAT→pat, Assets→totalAssets.
        assertThat(enrichment.financials()).hasSize(3);
        IpoFinancialRowDto fy26 = enrichment.financials().get(0);
        assertThat(fy26.fiscalYear()).isEqualTo("31 Mar 2026");
        assertThat(fy26.periodEnd()).isEqualTo(LocalDate.of(2026, 3, 31)); // "d MMM yyyy"
        assertThat(fy26.revenue()).isEqualByComparingTo("366.01");
        assertThat(fy26.pat()).isEqualByComparingTo("40.73");
        assertThat(fy26.totalAssets()).isEqualByComparingTo("341.97");

        IpoFinancialRowDto fy25 = enrichment.financials().get(1);
        assertThat(fy25.fiscalYear()).isEqualTo("31 Mar 2025");
        assertThat(fy25.revenue()).isEqualByComparingTo("276.53");
        assertThat(fy25.pat()).isEqualByComparingTo("30.03");
        assertThat(fy25.totalAssets()).isEqualByComparingTo("321.79");

        IpoFinancialRowDto fy24 = enrichment.financials().get(2);
        assertThat(fy24.fiscalYear()).isEqualTo("31 Mar 2024");
        assertThat(fy24.revenue()).isEqualByComparingTo("233.26");
    }

    @Test
    void parseDetail_noSummaryOrFinancialTable_returnsNullsAndEmpty() {
        Document doc = Jsoup.parse("<html><body><p>Nothing relevant here.</p></body></html>", DETAIL_URL);

        ChittorgarhSource.DetailEnrichment enrichment = newSource().parseDetail(doc);

        assertThat(enrichment.about()).isNull();
        assertThat(enrichment.strengths()).isNull();
        assertThat(enrichment.risks()).isNull();
        assertThat(enrichment.financials()).isEmpty();
    }

    @Test
    void parseDetail_ipoSummaryAbsent_fallsBackToAboutHeadingParagraphs() {
        // No #ipoSummary id → the heading-based fallback picks up the About paragraphs.
        String html = """
                <html><body>
                <h2>About Delta Robotics Ltd</h2>
                <div class="content-wrapper">
                <p>Delta Robotics builds automation solutions for warehouses.</p>
                </div>
                </body></html>
                """;
        Document doc = Jsoup.parse(html, DETAIL_URL);

        ChittorgarhSource.DetailEnrichment enrichment = newSource().parseDetail(doc);

        assertThat(enrichment.about()).isEqualTo("Delta Robotics builds automation solutions for warehouses.");
        assertThat(enrichment.strengths()).isNull();
    }

    @Test
    void fetchAll_enrichesRowWithDetailPageDataViaItsRowAnchor() {
        when(httpClient.get(eq(LIST_URL_PAGE1), any()))
                .thenReturn(new IpoHttpResponse(ACME_LIST_JSON, new HttpHeaders()));
        when(httpClient.get(eq(DETAIL_URL), any()))
                .thenReturn(new IpoHttpResponse(DETAIL_FIXTURE_HTML, new HttpHeaders()));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).hasSize(1);
        IpoDto acme = result.get(0);
        assertThat(acme.companyName()).isEqualTo("Acme Robotics Ltd"); // core list data untouched
        assertThat(acme.about()).contains("Incorporated in 2002");
        assertThat(acme.strengths()).contains("Strong industrial robotics portfolio");
        assertThat(acme.risks()).isNull();
        assertThat(acme.financials()).hasSize(3);
    }

    @Test
    void fetchAll_detailPageFetchThrows_skipsEnrichmentButKeepsCoreListData() {
        when(httpClient.get(eq(LIST_URL_PAGE1), any()))
                .thenReturn(new IpoHttpResponse(ACME_LIST_JSON, new HttpHeaders()));
        when(httpClient.get(eq(DETAIL_URL), any())).thenThrow(new SourceFetchException("blocked"));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).hasSize(1); // whole fetchAll still succeeds
        IpoDto acme = result.get(0);
        assertThat(acme.companyName()).isEqualTo("Acme Robotics Ltd");
        assertThat(acme.about()).isNull();
        assertThat(acme.financials()).isNull();
    }

    // ── Unit 2: bound the per-IPO detail-page fetch to a relevant, capped subset ───────────────

    private static String jsonRow(String company, String detailHref, String listingDateCell) {
        return "{\"Company\":\"<a href=\\\"" + detailHref + "\\\">" + company + "</a>\","
                + "\"Issue Category\":\"Mainboard\",\"Opening Date\":\"01-Jul-2026\",\"Closing Date\":\"03-Jul-2026\","
                + "\"Listing Date\":\"" + listingDateCell + "\",\"Issue Price (Rs.)\":\"100.00 to 110.00\","
                + "\"Listing at\":\"BSE, NSE\"}";
    }

    private static String listJson(String joinedRows) {
        return "{\"reportTableData\":[" + joinedRows + "],\"totalPages\":1}";
    }

    private static String detailFixtureFor(String companyLabel) {
        return "<html><body><h2>About " + companyLabel + "</h2><p>" + companyLabel
                + " own description, unique to this company.</p></body></html>";
    }

    private static final String UPCOMING_DETAIL_URL = "https://www.chittorgarh.com/ipo/upcoming-co/1/";
    private static final String RECENT_DETAIL_URL = "https://www.chittorgarh.com/ipo/recent-co/2/";
    private static final String OLD_DETAIL_URL = "https://www.chittorgarh.com/ipo/old-co/3/";

    @Test
    void fetchAll_enrichmentGate_skipsRowsListedMoreThanAboutAMonthAgo() {
        String html = listJson(String.join(",",
                jsonRow("Upcoming Co", UPCOMING_DETAIL_URL, "")                 // no listing date yet
                        + "," + jsonRow("Recently Listed Co", RECENT_DETAIL_URL, "14-Jul-2026") // 10 days before TODAY
                        + "," + jsonRow("Old Listed Co", OLD_DETAIL_URL, "01-Jan-2026")));       // ~204 days before TODAY

        when(httpClient.get(eq(LIST_URL_PAGE1), any())).thenReturn(new IpoHttpResponse(html, new HttpHeaders()));
        when(httpClient.get(eq(UPCOMING_DETAIL_URL), any()))
                .thenReturn(new IpoHttpResponse(detailFixtureFor("Upcoming Co"), new HttpHeaders()));
        when(httpClient.get(eq(RECENT_DETAIL_URL), any()))
                .thenReturn(new IpoHttpResponse(detailFixtureFor("Recently Listed Co"), new HttpHeaders()));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).hasSize(3);
        assertThat(result.get(0).about()).contains("Upcoming Co own description");
        assertThat(result.get(1).about()).contains("Recently Listed Co own description");
        assertThat(result.get(2).about()).isNull(); // gated out — listed 01-Jan-2026, > 30 days before TODAY

        verify(httpClient, never()).get(eq(OLD_DETAIL_URL), any());
    }

    @Test
    void fetchAll_enrichmentCap_boundsDetailFetchesToAtMost25EvenWhenMoreAreEligible() {
        int totalEligibleRows = 27;
        StringBuilder rows = new StringBuilder();
        for (int i = 1; i <= totalEligibleRows; i++) {
            if (i > 1) {
                rows.append(",");
            }
            // All "upcoming" (no listing date) → all gate-eligible; only the cap should limit fetches.
            rows.append(jsonRow("Company " + i, "https://www.chittorgarh.com/ipo/company-" + i + "/" + i + "/", ""));
        }
        String html = listJson(rows.toString());

        when(httpClient.get(eq(LIST_URL_PAGE1), any())).thenReturn(new IpoHttpResponse(html, new HttpHeaders()));
        when(httpClient.get(argThat(url -> url != null && url.contains("/ipo/company-")), any()))
                .thenReturn(new IpoHttpResponse(detailFixtureFor("Some Co"), new HttpHeaders()));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).hasSize(totalEligibleRows); // every row still returned, just not all enriched
        verify(httpClient, times(25))
                .get(argThat(url -> url != null && url.contains("/ipo/company-")), any());
    }
}
