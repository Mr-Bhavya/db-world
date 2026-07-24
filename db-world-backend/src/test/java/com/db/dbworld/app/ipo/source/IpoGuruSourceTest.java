package com.db.dbworld.app.ipo.source;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.ipo.dto.IpoDto;
import com.db.dbworld.app.ipo.source.support.IpoHttpClient;
import com.db.dbworld.app.ipo.source.support.IpoHttpResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IpoGuruSourceTest {

    @Mock
    SettingsService settingsService;

    @Mock
    IpoHttpClient httpClient;

    // Synthesized fixture matching the documented { success, count, data[] } envelope.
    private static final String FIXTURE = """
            {
              "success": true,
              "count": 2,
              "data": [
                {
                  "name": "Acme Robotics Ltd",
                  "type": "mainboard",
                  "status": "open",
                  "open_date": "2026-07-21",
                  "close_date": "2026-07-23",
                  "allotment_date": "2026-07-24",
                  "listing_date": "2026-07-28",
                  "price_band_min": "115",
                  "price_band_max": "120",
                  "lot_size": "125",
                  "issue_size": "500 Cr",
                  "listing_exchange": "BSE, NSE",
                  "registrar": "Link Intime",
                  "subscription": { "qib": "12.50", "nii": "8.30", "retail": "3.10", "total": "7.20" },
                  "gmp": { "value": "25", "pct": "20.83" }
                },
                {
                  "name": "Beta Textiles Ltd",
                  "type": "sme",
                  "status": "upcoming",
                  "open_date": "05-Aug-2026",
                  "close_date": "07-Aug-2026",
                  "issue_price": "80"
                }
              ]
            }
            """;

    private IpoGuruSource newSource(String apiKey) {
        return new IpoGuruSource(settingsService, httpClient) {
            @Override
            String resolveApiKey() {
                return apiKey;
            }
        };
    }

    @Test
    void fetchAll_mapsDocumentedFields() {
        when(settingsService.getString(ConfigKeys.IPO_IPOGURU_BASE_URL)).thenReturn("https://www.ipoguru.in/api/v1");
        when(httpClient.get(eq("https://www.ipoguru.in/api/v1/ipos"), any()))
                .thenReturn(new IpoHttpResponse(200, FIXTURE, new HttpHeaders()));

        List<IpoDto> result = newSource("test-key").fetchAll();

        assertThat(result).hasSize(2);

        IpoDto acme = result.get(0);
        assertThat(acme.source()).isEqualTo("ipoguru");
        assertThat(acme.matchKey()).isNull();
        assertThat(acme.companyName()).isEqualTo("Acme Robotics Ltd");
        assertThat(acme.ipoType()).isEqualTo("mainboard");
        assertThat(acme.status()).isEqualTo("open");
        assertThat(acme.openDate()).isEqualTo(LocalDate.of(2026, 7, 21));
        assertThat(acme.closeDate()).isEqualTo(LocalDate.of(2026, 7, 23));
        assertThat(acme.allotmentDate()).isEqualTo(LocalDate.of(2026, 7, 24));
        assertThat(acme.listingDate()).isEqualTo(LocalDate.of(2026, 7, 28));
        assertThat(acme.priceMin()).isEqualByComparingTo("115");
        assertThat(acme.priceMax()).isEqualByComparingTo("120");
        assertThat(acme.lotSize()).isEqualTo(125);
        assertThat(acme.issueSize()).isEqualTo("500 Cr");
        assertThat(acme.listingExchange()).isEqualTo("BSE, NSE");
        assertThat(acme.registrar()).isEqualTo("Link Intime");
        assertThat(acme.subQib()).isEqualByComparingTo("12.50");
        assertThat(acme.subNii()).isEqualByComparingTo("8.30");
        assertThat(acme.subRetail()).isEqualByComparingTo("3.10");
        assertThat(acme.subTotal()).isEqualByComparingTo("7.20");
        assertThat(acme.gmp()).isEqualByComparingTo("25");
        assertThat(acme.gmpPct()).isEqualByComparingTo("20.83");

        IpoDto beta = result.get(1);
        assertThat(beta.companyName()).isEqualTo("Beta Textiles Ltd");
        assertThat(beta.ipoType()).isEqualTo("sme");
        assertThat(beta.status()).isEqualTo("upcoming");
        assertThat(beta.openDate()).isEqualTo(LocalDate.of(2026, 8, 5)); // dd-MMM-yyyy fallback parse
        assertThat(beta.closeDate()).isEqualTo(LocalDate.of(2026, 8, 7));
        // no price band reported — falls back to issue_price for both bounds
        assertThat(beta.priceMin()).isEqualByComparingTo("80");
        assertThat(beta.priceMax()).isEqualByComparingTo("80");
        assertThat(beta.gmp()).isNull();
        assertThat(beta.subQib()).isNull();
    }

    @Test
    void fetchAll_httpClientThrows_returnsEmptyList() {
        when(settingsService.getString(ConfigKeys.IPO_IPOGURU_BASE_URL)).thenReturn("https://www.ipoguru.in/api/v1");
        when(httpClient.get(anyString(), any())).thenThrow(new SourceFetchException("boom"));

        List<IpoDto> result = newSource("test-key").fetchAll();

        assertThat(result).isEmpty();
    }

    @Test
    void fetchAll_malformedJson_returnsEmptyList() {
        when(settingsService.getString(ConfigKeys.IPO_IPOGURU_BASE_URL)).thenReturn("https://www.ipoguru.in/api/v1");
        when(httpClient.get(anyString(), any()))
                .thenReturn(new IpoHttpResponse(200, "not json", new HttpHeaders()));

        List<IpoDto> result = newSource("test-key").fetchAll();

        assertThat(result).isEmpty();
    }

    @Test
    void fetchAll_blankApiKey_returnsEmptyWithoutCallingHttpClient() {
        List<IpoDto> result = newSource("   ").fetchAll();

        assertThat(result).isEmpty();
        verifyNoInteractions(httpClient);
    }

    @Test
    void fetchAll_nullApiKey_returnsEmptyWithoutCallingHttpClient() {
        List<IpoDto> result = newSource(null).fetchAll();

        assertThat(result).isEmpty();
        verifyNoInteractions(httpClient);
    }
}
