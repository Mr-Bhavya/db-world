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

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChittorgarhSourceTest {

    @Mock
    IpoHttpClient httpClient;

    // Fixed "now" so the dynamic-year list URL and the recent-listing enrichment gate are
    // deterministic in tests: 24-Jul-2026, same reference date used elsewhere in the IPO test suite.
    private static final Instant NOW = Instant.parse("2026-07-24T10:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    private static final String LIST_URL =
            "https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/all/?year="
                    + Year.now(CLOCK).getValue();

    private ChittorgarhSource newSource() {
        return new ChittorgarhSource(httpClient, CLOCK);
    }

    // Synthesized fixture matching the REAL list-page column set (from the live-page screenshot):
    // Company | Issue Category | Pricing Method | Opening Date | Closing Date | Listing Date |
    // Issue Price (Rs.) | Total Issue Amount (Incl.Firm Reservations) (Rs.Cr.) | Fresh Capital
    // (Rs.Cr.) | Offer For Sale (Rs.Cr.) | Issue Amount (Rs.Cr.) | Listing At | Left Lead Manager |
    // Compare. "Pricing Method", "Issue Amount (Rs.Cr.)", "Left Lead Manager" and "Compare" are
    // deliberately NOT mapped (see class javadoc) but are still present in the fixture so the
    // column-matching is exercised against the real shape, not a pre-trimmed one.
    private static final String FIXTURE_HTML = """
            <html><body>
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Issue Category</th>
                  <th>Pricing Method</th>
                  <th>Opening Date</th>
                  <th>Closing Date</th>
                  <th>Listing Date</th>
                  <th>Issue Price (Rs.)</th>
                  <th>Total Issue Amount (Incl.Firm Reservations) (Rs.Cr.)</th>
                  <th>Fresh Capital (Rs.Cr.)</th>
                  <th>Offer For Sale (Rs.Cr.)</th>
                  <th>Issue Amount (Rs.Cr.)</th>
                  <th>Listing At</th>
                  <th>Left Lead Manager</th>
                  <th>Compare</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><a href="/ipo/acme-robotics/123/">Acme Robotics Ltd</a></td>
                  <td>SME</td>
                  <td>Book Building</td>
                  <td>31-Jul-2026</td>
                  <td>04-Aug-2026</td>
                  <td></td>
                  <td>151.00 to 159.00</td>
                  <td>39.04</td>
                  <td>29.67</td>
                  <td>7.41</td>
                  <td>39.04</td>
                  <td>BSE SME</td>
                  <td>Some Lead Manager Pvt Ltd</td>
                  <td><input type="checkbox"/></td>
                </tr>
                <tr>
                  <td>Beta Textiles Ltd</td>
                  <td>Mainboard</td>
                  <td>Book Building</td>
                  <td>05-Aug-2026</td>
                  <td>07-Aug-2026</td>
                  <td></td>
                  <td></td>
                  <td>1,800.00</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td>BSE, NSE</td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
            </body></html>
            """;

    private static final String DETAIL_URL = "https://www.chittorgarh.com/ipo/acme-robotics/123/";

    // Synthesized detail-page fixture: About paragraphs, Strengths/Risks bullet lists, and the
    // "Company Financials" table, matched by heading TEXT (Chittorgarh's detail markup carries no
    // stable semantic classes/ids for these sections either) — TODO(verify) against a live page.
    private static final String DETAIL_FIXTURE_HTML = """
            <html><body>
            <h2>About Acme Robotics Ltd</h2>
            <p>Acme Robotics designs and manufactures industrial robotics for the automotive sector.</p>
            <p>It has a pan-India distribution network.</p>

            <h2>Acme Robotics Strengths</h2>
            <ul>
              <li>Strong industrial robotics portfolio</li>
              <li>Established automotive OEM relationships</li>
            </ul>

            <h2>Risks</h2>
            <ul>
              <li>Reliant on automotive sector capex cycles</li>
              <li>Customer concentration risk</li>
            </ul>

            <h2>Company Financials</h2>
            <table>
              <thead>
                <tr><th>Period</th><th>Revenue</th><th>Profit After Tax</th><th>Total Assets</th></tr>
              </thead>
              <tbody>
                <tr><td>FY 2022-23</td><td>4192.40</td><td>(971.00)</td><td>6800.00</td></tr>
                <tr><td>FY 2023-24</td><td>7079.60</td><td>175.00</td><td>9600.00</td></tr>
                <tr><td>Mar 2025</td><td>3200.00</td><td>50.00</td><td>4000.00</td></tr>
              </tbody>
            </table>
            </body></html>
            """;

    @Test
    void parseTable_mapsDocumentedColumns() {
        Document doc = Jsoup.parse(FIXTURE_HTML, LIST_URL);

        List<IpoDto> result = newSource().parseTable(doc);

        assertThat(result).hasSize(2);

        IpoDto acme = result.get(0);
        assertThat(acme.source()).isEqualTo("chittorgarh");
        assertThat(acme.matchKey()).isNull();
        assertThat(acme.companyName()).isEqualTo("Acme Robotics Ltd");
        assertThat(acme.ipoType()).isEqualTo("SME"); // raw "Issue Category" text; ingest canonicalizes
        assertThat(acme.openDate()).isEqualTo(LocalDate.of(2026, 7, 31));
        assertThat(acme.closeDate()).isEqualTo(LocalDate.of(2026, 8, 4));
        assertThat(acme.allotmentDate()).isNull();      // no "Allotment Date" column on the real page
        assertThat(acme.listingDate()).isNull();        // blank cell
        assertThat(acme.priceMin()).isEqualByComparingTo("151.00");
        assertThat(acme.priceMax()).isEqualByComparingTo("159.00");
        assertThat(acme.lotSize()).isNull();            // no "Lot Size" column on the real page
        assertThat(acme.issueSize()).isEqualTo("₹39.04 Cr");
        assertThat(acme.freshIssue()).isEqualByComparingTo("29.67");
        assertThat(acme.offerForSale()).isEqualByComparingTo("7.41");
        assertThat(acme.listingExchange()).isEqualTo("BSE"); // "BSE SME" -> BSE, SME suffix ignored
        assertThat(acme.registrar()).isNull();          // "Left Lead Manager" is NOT the registrar
        assertThat(acme.registrarUrl()).isNull();
        assertThat(acme.listingGainPct()).isNull();     // no "Listing Gain" column on the real page
    }

    @Test
    void parseTable_mainboardRowWithBlankPriceBandAndBothExchanges() {
        Document doc = Jsoup.parse(FIXTURE_HTML, LIST_URL);

        List<IpoDto> result = newSource().parseTable(doc);

        IpoDto beta = result.get(1);
        assertThat(beta.companyName()).isEqualTo("Beta Textiles Ltd");
        assertThat(beta.ipoType()).isEqualTo("Mainboard");
        assertThat(beta.openDate()).isEqualTo(LocalDate.of(2026, 8, 5));
        assertThat(beta.closeDate()).isEqualTo(LocalDate.of(2026, 8, 7));
        assertThat(beta.listingDate()).isNull();        // blank cell
        assertThat(beta.priceMin()).isNull();           // blank "Issue Price" cell
        assertThat(beta.priceMax()).isNull();
        assertThat(beta.issueSize()).isEqualTo("₹1,800.00 Cr"); // comma thousands kept in the label
        assertThat(beta.freshIssue()).isNull();         // blank cell
        assertThat(beta.offerForSale()).isNull();       // blank cell
        assertThat(beta.listingExchange()).isEqualTo("BOTH"); // "BSE, NSE" -> BOTH
    }

    @Test
    void parseTable_issuePriceSingleValueWithoutTo_yieldsNullBand() {
        Document doc = Jsoup.parse("""
                <html><body>
                <table>
                  <thead><tr><th>Company</th><th>Issue Price (Rs.)</th></tr></thead>
                  <tbody><tr><td>Fixed Price Co</td><td>172.00</td></tr></tbody>
                </table>
                </body></html>
                """, LIST_URL);

        List<IpoDto> result = newSource().parseTable(doc);

        assertThat(result.get(0).priceMin()).isNull();
        assertThat(result.get(0).priceMax()).isNull();
    }

    @Test
    void parseTable_issuePriceZeroZeroPlaceholder_yieldsNullBand() {
        Document doc = Jsoup.parse("""
                <html><body>
                <table>
                  <thead><tr><th>Company</th><th>Issue Price (Rs.)</th></tr></thead>
                  <tbody><tr><td>Not Yet Priced Co</td><td>0.00 to 0.00</td></tr></tbody>
                </table>
                </body></html>
                """, LIST_URL);

        List<IpoDto> result = newSource().parseTable(doc);

        assertThat(result.get(0).priceMin()).isNull();
        assertThat(result.get(0).priceMax()).isNull();
    }

    @Test
    void parseTable_totalIssueAmountBlank_yieldsNullIssueSize() {
        Document doc = Jsoup.parse("""
                <html><body>
                <table>
                  <thead><tr><th>Company</th><th>Total Issue Amount (Incl.Firm Reservations) (Rs.Cr.)</th></tr></thead>
                  <tbody><tr><td>No Amount Co</td><td></td></tr></tbody>
                </table>
                </body></html>
                """, LIST_URL);

        List<IpoDto> result = newSource().parseTable(doc);

        assertThat(result.get(0).issueSize()).isNull();
    }

    @Test
    void parseTable_noTableOnPage_returnsEmptyList() {
        Document doc = Jsoup.parse("<html><body><p>no data</p></body></html>", LIST_URL);

        List<IpoDto> result = newSource().parseTable(doc);

        assertThat(result).isEmpty();
    }

    @Test
    void fetchAll_delegatesToHttpClientAndParsesResult() {
        when(httpClient.get(eq(LIST_URL), any()))
                .thenReturn(new IpoHttpResponse(FIXTURE_HTML, new HttpHeaders()));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).companyName()).isEqualTo("Acme Robotics Ltd");
    }

    @Test
    void fetchAll_httpClientThrows_returnsEmptyList() {
        when(httpClient.get(eq(LIST_URL), any())).thenThrow(new SourceFetchException("blocked"));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).isEmpty();
    }

    // ── Detail-page enrichment (About/Strengths/Risks/Financials) ──────────────────────────────

    @Test
    void parseDetail_extractsAboutStrengthsRisksAndFinancials() {
        Document doc = Jsoup.parse(DETAIL_FIXTURE_HTML, DETAIL_URL);

        ChittorgarhSource.DetailEnrichment enrichment = newSource().parseDetail(doc);

        assertThat(enrichment.about()).isEqualTo(
                "Acme Robotics designs and manufactures industrial robotics for the automotive sector. "
                        + "It has a pan-India distribution network.");
        assertThat(enrichment.strengths()).isEqualTo(
                "Strong industrial robotics portfolio\nEstablished automotive OEM relationships");
        assertThat(enrichment.risks()).isEqualTo(
                "Reliant on automotive sector capex cycles\nCustomer concentration risk");

        assertThat(enrichment.financials()).hasSize(3);
        IpoFinancialRowDto fy23 = enrichment.financials().get(0);
        assertThat(fy23.fiscalYear()).isEqualTo("FY 2022-23");
        assertThat(fy23.periodEnd()).isEqualTo(LocalDate.of(2023, 3, 31));
        assertThat(fy23.revenue()).isEqualByComparingTo("4192.40");
        assertThat(fy23.pat()).isEqualByComparingTo("-971.00"); // parenthesis notation -> negative
        assertThat(fy23.totalAssets()).isEqualByComparingTo("6800.00");

        IpoFinancialRowDto fy24 = enrichment.financials().get(1);
        assertThat(fy24.fiscalYear()).isEqualTo("FY 2023-24");
        assertThat(fy24.periodEnd()).isEqualTo(LocalDate.of(2024, 3, 31));
        assertThat(fy24.pat()).isEqualByComparingTo("175.00");

        IpoFinancialRowDto interim = enrichment.financials().get(2);
        assertThat(interim.fiscalYear()).isEqualTo("Mar 2025");
        assertThat(interim.periodEnd()).isEqualTo(LocalDate.of(2025, 3, 31)); // "Mon yyyy" -> end of month
        assertThat(interim.revenue()).isEqualByComparingTo("3200.00");
    }

    @Test
    void parseDetail_noMatchingSections_returnsNullsAndEmptyFinancials() {
        Document doc = Jsoup.parse("<html><body><p>Nothing relevant here.</p></body></html>", DETAIL_URL);

        ChittorgarhSource.DetailEnrichment enrichment = newSource().parseDetail(doc);

        assertThat(enrichment.about()).isNull();
        assertThat(enrichment.strengths()).isNull();
        assertThat(enrichment.risks()).isNull();
        assertThat(enrichment.financials()).isEmpty();
    }

    @Test
    void parseDetail_headingWithNoFollowingBulletList_returnsNull() {
        Document doc = Jsoup.parse("<html><body><h2>Strengths</h2><p>Not a list.</p></body></html>", DETAIL_URL);

        ChittorgarhSource.DetailEnrichment enrichment = newSource().parseDetail(doc);

        assertThat(enrichment.strengths()).isNull();
    }

    @Test
    void fetchAll_enrichesRowWithDetailPageDataViaItsRowAnchor() {
        when(httpClient.get(eq(LIST_URL), any()))
                .thenReturn(new IpoHttpResponse(FIXTURE_HTML, new HttpHeaders()));
        when(httpClient.get(eq(DETAIL_URL), any()))
                .thenReturn(new IpoHttpResponse(DETAIL_FIXTURE_HTML, new HttpHeaders()));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).hasSize(2);
        IpoDto acme = result.get(0);
        assertThat(acme.companyName()).isEqualTo("Acme Robotics Ltd"); // core list data untouched
        assertThat(acme.about()).startsWith("Acme Robotics designs and manufactures");
        assertThat(acme.strengths()).contains("Strong industrial robotics portfolio");
        assertThat(acme.risks()).contains("Reliant on automotive sector capex cycles");
        assertThat(acme.financials()).hasSize(3);

        // Beta Textiles' row has no anchor in the fixture -> no detail URL -> no enrichment attempted.
        IpoDto beta = result.get(1);
        assertThat(beta.companyName()).isEqualTo("Beta Textiles Ltd");
        assertThat(beta.about()).isNull();
        assertThat(beta.strengths()).isNull();
        assertThat(beta.risks()).isNull();
        assertThat(beta.financials()).isNull();
    }

    @Test
    void fetchAll_detailPageFetchThrows_skipsEnrichmentButKeepsCoreListData() {
        when(httpClient.get(eq(LIST_URL), any()))
                .thenReturn(new IpoHttpResponse(FIXTURE_HTML, new HttpHeaders()));
        when(httpClient.get(eq(DETAIL_URL), any())).thenThrow(new SourceFetchException("blocked"));

        List<IpoDto> result = newSource().fetchAll();

        assertThat(result).hasSize(2); // whole fetchAll still succeeds
        IpoDto acme = result.get(0);
        assertThat(acme.companyName()).isEqualTo("Acme Robotics Ltd");
        assertThat(acme.about()).isNull();
        assertThat(acme.financials()).isNull();
    }

    // ── Regression: an empty/spacer data row must never shift detail URLs onto the wrong company ──

    private static final String DETAIL_URL_A = "https://www.chittorgarh.com/ipo/company-a/1/";
    private static final String DETAIL_URL_B = "https://www.chittorgarh.com/ipo/company-b/2/";
    private static final String DETAIL_URL_C = "https://www.chittorgarh.com/ipo/company-c/3/";

    // A spacer/ad row with ZERO <td> cells (only a <th>) sits between Company A and Company B.
    // parseTable's `if (cells.isEmpty()) continue;` skips it when building `listed`; the detail-url
    // resolution must skip it identically so the two never drift out of alignment. Listing dates
    // are all within the ±30-day enrichment-gate window (TODAY = 2026-07-24) so this fixture
    // exercises ONLY the spacer-row regression, not the gate/cap from Unit 2.
    private static final String FIXTURE_HTML_WITH_SPACER_ROW = """
            <html><body>
            <table>
              <thead>
                <tr>
                  <th>Company</th><th>Issue Category</th><th>Opening Date</th><th>Closing Date</th>
                  <th>Listing Date</th><th>Issue Price (Rs.)</th>
                  <th>Total Issue Amount (Incl.Firm Reservations) (Rs.Cr.)</th>
                  <th>Fresh Capital (Rs.Cr.)</th><th>Offer For Sale (Rs.Cr.)</th><th>Listing At</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><a href="/ipo/company-a/1/">Company A Ltd</a></td>
                  <td>Mainboard</td><td>01-Jul-2026</td><td>03-Jul-2026</td><td>08-Jul-2026</td>
                  <td>100.00 to 110.00</td><td>200.00</td><td>150.00</td><td>50.00</td><td>BSE, NSE</td>
                </tr>
                <tr><th colspan="10">-- Advertisement --</th></tr>
                <tr>
                  <td><a href="/ipo/company-b/2/">Company B Ltd</a></td>
                  <td>Mainboard</td><td>11-Jul-2026</td><td>13-Jul-2026</td><td>18-Jul-2026</td>
                  <td>200.00 to 210.00</td><td>300.00</td><td>200.00</td><td>100.00</td><td>NSE</td>
                </tr>
                <tr>
                  <td><a href="/ipo/company-c/3/">Company C Ltd</a></td>
                  <td>SME</td><td>21-Jul-2026</td><td>23-Jul-2026</td><td>28-Jul-2026</td>
                  <td>300.00 to 310.00</td><td>400.00</td><td>250.00</td><td>150.00</td><td>BSE SME</td>
                </tr>
              </tbody>
            </table>
            </body></html>
            """;

    private static String detailFixtureFor(String companyLabel) {
        return "<html><body><h2>About " + companyLabel + "</h2><p>" + companyLabel
                + " own description, unique to this company.</p></body></html>";
    }

    @Test
    void fetchAll_emptySpacerRowBetweenCompanies_doesNotMisattributeDetailData() {
        when(httpClient.get(eq(LIST_URL), any()))
                .thenReturn(new IpoHttpResponse(FIXTURE_HTML_WITH_SPACER_ROW, new HttpHeaders()));
        when(httpClient.get(eq(DETAIL_URL_A), any()))
                .thenReturn(new IpoHttpResponse(detailFixtureFor("Company A Ltd"), new HttpHeaders()));
        when(httpClient.get(eq(DETAIL_URL_B), any()))
                .thenReturn(new IpoHttpResponse(detailFixtureFor("Company B Ltd"), new HttpHeaders()));
        when(httpClient.get(eq(DETAIL_URL_C), any()))
                .thenReturn(new IpoHttpResponse(detailFixtureFor("Company C Ltd"), new HttpHeaders()));

        List<IpoDto> result = newSource().fetchAll();

        // The spacer row (zero <td> cells) must be skipped, not counted as a company.
        assertThat(result).hasSize(3);

        IpoDto a = result.get(0);
        IpoDto b = result.get(1);
        IpoDto c = result.get(2);
        assertThat(a.companyName()).isEqualTo("Company A Ltd");
        assertThat(b.companyName()).isEqualTo("Company B Ltd");
        assertThat(c.companyName()).isEqualTo("Company C Ltd");

        // Each company must be enriched from its OWN detail page — never a neighbour's.
        assertThat(a.about()).contains("Company A Ltd own description");
        assertThat(b.about()).contains("Company B Ltd own description");
        assertThat(c.about()).contains("Company C Ltd own description");

        // The specific regression: with the spacer row shifting a stale index, Company C would
        // previously receive Company B's detail-page data instead of its own.
        assertThat(c.about()).isNotEqualTo(b.about());
        assertThat(c.about()).doesNotContain("Company B");
    }

    // ── Strengths/Risks heading collision: a combined "Strengths and Risks" heading matches both
    // STRENGTHS_HEADING and RISKS_HEADING patterns and must not yield duplicate content for both ──

    private static final String DETAIL_FIXTURE_COMBINED_STRENGTHS_RISKS_HEADING_HTML = """
            <html><body>
            <h2>About Gamma Textiles Ltd</h2>
            <p>Gamma Textiles manufactures synthetic yarns.</p>

            <h2>Strengths and Risks</h2>
            <ul>
              <li>Strong brand recognition</li>
              <li>Established supplier network</li>
            </ul>
            </body></html>
            """;

    @Test
    void parseDetail_combinedStrengthsAndRisksHeading_doesNotDuplicateContentIntoRisks() {
        Document doc = Jsoup.parse(DETAIL_FIXTURE_COMBINED_STRENGTHS_RISKS_HEADING_HTML, DETAIL_URL);

        ChittorgarhSource.DetailEnrichment enrichment = newSource().parseDetail(doc);

        assertThat(enrichment.strengths())
                .isEqualTo("Strong brand recognition\nEstablished supplier network");
        // The combined heading is claimed by strengths; risks must not duplicate it.
        assertThat(enrichment.risks()).isNotEqualTo(enrichment.strengths());
        assertThat(enrichment.risks()).isNull();
    }

    // ── About robustness: an About paragraph wrapped in an intermediate <div> (rather than being a
    // direct sibling of the heading) should still be found, mirroring extractBullets/extractFinancials ──

    private static final String DETAIL_FIXTURE_ABOUT_WRAPPED_IN_DIV_HTML = """
            <html><body>
            <h2>About Delta Robotics Ltd</h2>
            <div class="content-wrapper">
            <p>Delta Robotics builds automation solutions for warehouses.</p>
            </div>
            </body></html>
            """;

    @Test
    void parseDetail_aboutParagraphWrappedInDiv_stillExtracted() {
        Document doc = Jsoup.parse(DETAIL_FIXTURE_ABOUT_WRAPPED_IN_DIV_HTML, DETAIL_URL);

        ChittorgarhSource.DetailEnrichment enrichment = newSource().parseDetail(doc);

        assertThat(enrichment.about()).isEqualTo("Delta Robotics builds automation solutions for warehouses.");
    }
}
