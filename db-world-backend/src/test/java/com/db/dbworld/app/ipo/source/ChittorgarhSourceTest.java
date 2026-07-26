package com.db.dbworld.app.ipo.source;

import com.db.dbworld.app.ipo.dto.IpoDto;
import com.db.dbworld.app.ipo.source.support.IpoHttpClient;
import com.db.dbworld.app.ipo.source.support.IpoHttpResponse;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChittorgarhSourceTest {

    @Mock
    IpoHttpClient httpClient;

    private static final String LIST_URL = "https://www.chittorgarh.com/report/mainboard-ipo-list-in-india-bse-nse/83/";

    // Synthesized fixture matching the documented mainboard-list table shape, including the
    // price band / lot size / issue size columns this adapter now also maps.
    private static final String FIXTURE_HTML = """
            <html><body>
            <table>
              <thead>
                <tr>
                  <th>IPO Name</th>
                  <th>Open Date</th>
                  <th>Close Date</th>
                  <th>Allotment Date</th>
                  <th>Listing Date</th>
                  <th>Price Band</th>
                  <th>Lot Size</th>
                  <th>Issue Size</th>
                  <th>Listing Gain</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><a href="/ipo/acme-robotics/123/">Acme Robotics Ltd</a></td>
                  <td>21-Jul-2026</td>
                  <td>23-Jul-2026</td>
                  <td>24-Jul-2026</td>
                  <td>28-Jul-2026</td>
                  <td>115-120</td>
                  <td>125</td>
                  <td>500 Cr</td>
                  <td>15.50%</td>
                </tr>
                <tr>
                  <td>Beta Textiles Ltd</td>
                  <td>05-Aug-2026</td>
                  <td>07-Aug-2026</td>
                  <td>08-Aug-2026</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td>&#8212;</td>
                </tr>
              </tbody>
            </table>
            </body></html>
            """;

    private ChittorgarhSource newSource() {
        return new ChittorgarhSource(httpClient);
    }

    @Test
    void parseTable_mapsDocumentedColumns() {
        Document doc = Jsoup.parse(FIXTURE_HTML, LIST_URL);

        List<IpoDto> result = newSource().parseTable(doc);

        assertThat(result).hasSize(2);

        IpoDto acme = result.get(0);
        assertThat(acme.source()).isEqualTo("chittorgarh");
        assertThat(acme.matchKey()).isNull();
        assertThat(acme.companyName()).isEqualTo("Acme Robotics Ltd");
        assertThat(acme.ipoType()).isEqualTo("mainboard");
        assertThat(acme.openDate()).isEqualTo(LocalDate.of(2026, 7, 21));
        assertThat(acme.closeDate()).isEqualTo(LocalDate.of(2026, 7, 23));
        assertThat(acme.allotmentDate()).isEqualTo(LocalDate.of(2026, 7, 24));
        assertThat(acme.listingDate()).isEqualTo(LocalDate.of(2026, 7, 28));
        assertThat(acme.priceMin()).isEqualByComparingTo("115");
        assertThat(acme.priceMax()).isEqualByComparingTo("120");
        assertThat(acme.lotSize()).isEqualTo(125);
        assertThat(acme.issueSize()).isEqualTo("500 Cr");
        assertThat(acme.listingGainPct()).isEqualByComparingTo("15.50");
    }

    @Test
    void parseTable_tolerablesMissingGainAndAnchorlessName() {
        Document doc = Jsoup.parse(FIXTURE_HTML, LIST_URL);

        List<IpoDto> result = newSource().parseTable(doc);

        IpoDto beta = result.get(1);
        assertThat(beta.companyName()).isEqualTo("Beta Textiles Ltd");
        assertThat(beta.openDate()).isEqualTo(LocalDate.of(2026, 8, 5));
        assertThat(beta.closeDate()).isEqualTo(LocalDate.of(2026, 8, 7));
        assertThat(beta.allotmentDate()).isEqualTo(LocalDate.of(2026, 8, 8));
        assertThat(beta.listingDate()).isNull();     // blank cell
        assertThat(beta.priceMin()).isNull();        // blank cell
        assertThat(beta.priceMax()).isNull();
        assertThat(beta.lotSize()).isNull();
        assertThat(beta.issueSize()).isNull();
        assertThat(beta.listingGainPct()).isNull();  // "—" placeholder, not yet listed
    }

    @Test
    void parseTable_singlePriceBandValue_bothBoundsEqual() {
        Document doc = Jsoup.parse("""
                <html><body>
                <table>
                  <thead><tr><th>IPO Name</th><th>Price Band</th></tr></thead>
                  <tbody><tr><td>Fixed Price Co</td><td>172</td></tr></tbody>
                </table>
                </body></html>
                """, LIST_URL);

        List<IpoDto> result = newSource().parseTable(doc);

        assertThat(result.get(0).priceMin()).isEqualByComparingTo("172");
        assertThat(result.get(0).priceMax()).isEqualByComparingTo("172");
    }

    @Test
    void parseTable_lotSizeWithNonDigitSuffix_stripsToDigitsOnly() {
        Document doc = Jsoup.parse("""
                <html><body>
                <table>
                  <thead><tr><th>IPO Name</th><th>Lot Size</th></tr></thead>
                  <tbody><tr><td>Shares Co</td><td>1,600 Shares</td></tr></tbody>
                </table>
                </body></html>
                """, LIST_URL);

        List<IpoDto> result = newSource().parseTable(doc);

        assertThat(result.get(0).lotSize()).isEqualTo(1600);
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
}
