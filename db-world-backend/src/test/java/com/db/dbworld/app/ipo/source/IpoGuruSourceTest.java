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
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IpoGuruSourceTest {

    @Mock
    SettingsService settingsService;

    @Mock
    IpoHttpClient httpClient;

    private static final String BASE_URL = "https://www.ipoguru.in/api/v1";

    // The REAL, documented IPO Guru sample response (single-IPO envelope).
    private static final String REAL_SAMPLE_FIXTURE = """
            {"success":true,"count":1,"data":[{"name":"Adisoft Technologies","type":"SME","sub_type":"NSE SME","open_date":"2026-04-23","close_date":"2026-04-27","allotment_date":"2026-04-28","listing_date":"2026-04-30","listing_price":null,"price_band":"163-172","issue_price":"172","face_value":"10","lot_size":"800","issue_size":"₹74 Cr","sale_type":"Fresh capital only","listing_on":"NSE","registrar":"Kfin Technologies Ltd.","status":"Open","subscription":{"qib":"3.65","nii":"1.80","retail":"1.13","total":"1.99","updated_at":"23 Apr 2026, 05:10 PM IST"},"gmp":{"price":"10","percentage":"6","updated_at":"23 Apr 2026, 04:53 PM IST"}}]}
            """;

    private IpoGuruSource newSource(String apiKey) {
        return new IpoGuruSource(settingsService, httpClient) {
            @Override
            String resolveApiKey() {
                return apiKey;
            }
        };
    }

    private void stubBaseUrlAndResponse(String body) {
        when(settingsService.getString(ConfigKeys.IPO_IPOGURU_BASE_URL)).thenReturn(BASE_URL);
        when(httpClient.get(eq(BASE_URL + "/ipos"), any())).thenReturn(new IpoHttpResponse(body, new HttpHeaders()));
    }

    @Test
    void fetchAll_mapsTheRealDocumentedSample() {
        stubBaseUrlAndResponse(REAL_SAMPLE_FIXTURE);

        List<IpoDto> result = newSource("test-key").fetchAll();

        assertThat(result).hasSize(1);
        IpoDto dto = result.get(0);

        assertThat(dto.source()).isEqualTo("ipoguru");
        assertThat(dto.matchKey()).isNull();
        assertThat(dto.companyName()).isEqualTo("Adisoft Technologies");
        assertThat(dto.ipoType()).isEqualTo("SME");
        assertThat(dto.status()).isEqualTo("Open");
        assertThat(dto.openDate()).isEqualTo(LocalDate.of(2026, 4, 23));
        assertThat(dto.closeDate()).isEqualTo(LocalDate.of(2026, 4, 27));
        assertThat(dto.allotmentDate()).isEqualTo(LocalDate.of(2026, 4, 28));
        assertThat(dto.listingDate()).isEqualTo(LocalDate.of(2026, 4, 30));
        assertThat(dto.listingPrice()).isNull();
        assertThat(dto.priceMin()).isEqualByComparingTo("163");
        assertThat(dto.priceMax()).isEqualByComparingTo("172");
        assertThat(dto.faceValue()).isEqualByComparingTo("10");
        assertThat(dto.lotSize()).isEqualTo(800);
        assertThat(dto.issueSize()).isEqualTo("₹74 Cr");
        assertThat(dto.listingExchange()).isEqualTo("NSE");
        assertThat(dto.registrar()).isEqualTo("Kfin Technologies Ltd.");
        assertThat(dto.subscriptionCategories()).containsExactly(
                java.util.Map.entry("QIB", new java.math.BigDecimal("3.65")),
                java.util.Map.entry("NII", new java.math.BigDecimal("1.80")),
                java.util.Map.entry("Retail", new java.math.BigDecimal("1.13")));
        assertThat(dto.subTotal()).isEqualByComparingTo("1.99");
        assertThat(dto.gmp()).isEqualByComparingTo("10");
        assertThat(dto.gmpPct()).isEqualByComparingTo("6");
        // Not part of this source's documented shape.
        assertThat(dto.registrarUrl()).isNull();
        assertThat(dto.logoUrl()).isNull();
        assertThat(dto.about()).isNull();
    }

    @Test
    void fetchAll_priceBandSingleValue_bothBoundsEqual() {
        stubBaseUrlAndResponse("""
                {"success":true,"count":1,"data":[{"name":"Fixed Price Co","price_band":"172","status":"Upcoming"}]}
                """);

        List<IpoDto> result = newSource("test-key").fetchAll();

        assertThat(result.get(0).priceMin()).isEqualByComparingTo("172");
        assertThat(result.get(0).priceMax()).isEqualByComparingTo("172");
    }

    @Test
    void fetchAll_priceBandBlank_fallsBackToIssuePriceForMaxOnly() {
        stubBaseUrlAndResponse("""
                {"success":true,"count":1,"data":[{"name":"Beta Textiles Ltd","issue_price":"80","status":"Upcoming"}]}
                """);

        List<IpoDto> result = newSource("test-key").fetchAll();

        assertThat(result.get(0).priceMin()).isNull();
        assertThat(result.get(0).priceMax()).isEqualByComparingTo("80");
    }

    @Test
    void fetchAll_priceBandAndIssuePriceBothAbsent_bothBoundsNull() {
        stubBaseUrlAndResponse("""
                {"success":true,"count":1,"data":[{"name":"No Price Co","status":"Upcoming"}]}
                """);

        List<IpoDto> result = newSource("test-key").fetchAll();

        assertThat(result.get(0).priceMin()).isNull();
        assertThat(result.get(0).priceMax()).isNull();
    }

    @Test
    void fetchAll_listingOnBseOnly_mapsToBse() {
        stubBaseUrlAndResponse("""
                {"success":true,"count":1,"data":[{"name":"BSE Co","listing_on":"BSE","status":"Open"}]}
                """);

        assertThat(newSource("test-key").fetchAll().get(0).listingExchange()).isEqualTo("BSE");
    }

    @Test
    void fetchAll_listingOnBothExchanges_mapsToBoth() {
        stubBaseUrlAndResponse("""
                {"success":true,"count":1,"data":[{"name":"Both Co","listing_on":"BSE, NSE","status":"Open"}]}
                """);

        assertThat(newSource("test-key").fetchAll().get(0).listingExchange()).isEqualTo("BOTH");
    }

    @Test
    void fetchAll_listingOnUnrecognized_mapsToNull() {
        stubBaseUrlAndResponse("""
                {"success":true,"count":1,"data":[{"name":"Unknown Co","listing_on":"Unknown","status":"Open"}]}
                """);

        assertThat(newSource("test-key").fetchAll().get(0).listingExchange()).isNull();
    }

    @Test
    void fetchAll_subscriptionCategoryBlank_isSkippedButOthersKept() {
        stubBaseUrlAndResponse("""
                {"success":true,"count":1,"data":[{"name":"Partial Sub Co","status":"Open",
                  "subscription":{"qib":"3.65","nii":"","retail":"1.13","total":"1.99"}}]}
                """);

        List<IpoDto> result = newSource("test-key").fetchAll();

        assertThat(result.get(0).subscriptionCategories()).containsOnlyKeys("QIB", "Retail");
    }

    @Test
    void fetchAll_noSubscriptionObject_subscriptionCategoriesIsNull() {
        stubBaseUrlAndResponse("""
                {"success":true,"count":1,"data":[{"name":"No Sub Co","status":"Open"}]}
                """);

        List<IpoDto> result = newSource("test-key").fetchAll();

        assertThat(result.get(0).subscriptionCategories()).isNull();
        assertThat(result.get(0).subTotal()).isNull();
    }

    @Test
    void fetchAll_gmpPercentageZero_mappedAsZeroNotNull() {
        stubBaseUrlAndResponse("""
                {"success":true,"count":1,"data":[{"name":"Zero Gmp Co","status":"Open",
                  "gmp":{"price":"0","percentage":"0"}}]}
                """);

        List<IpoDto> result = newSource("test-key").fetchAll();

        assertThat(result.get(0).gmp()).isEqualByComparingTo("0");
        assertThat(result.get(0).gmpPct()).isEqualByComparingTo("0");
    }

    @Test
    void fetchAll_httpClientThrows_returnsEmptyList() {
        when(settingsService.getString(ConfigKeys.IPO_IPOGURU_BASE_URL)).thenReturn(BASE_URL);
        when(httpClient.get(anyString(), any())).thenThrow(new SourceFetchException("boom"));

        List<IpoDto> result = newSource("test-key").fetchAll();

        assertThat(result).isEmpty();
    }

    @Test
    void fetchAll_malformedJson_returnsEmptyList() {
        stubBaseUrlAndResponse("not json");

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

    @Test
    void fetchAll_settingsServiceThrows_returnsEmptyList() {
        when(settingsService.getString(ConfigKeys.IPO_IPOGURU_BASE_URL))
                .thenThrow(new RuntimeException("settings lookup boom"));

        List<IpoDto> result = newSource("test-key").fetchAll();

        assertThat(result).isEmpty();
        verifyNoInteractions(httpClient);
    }

    @Test
    void fetchAll_httpTooManyRequests_logsRetryInfoAndReturnsEmptyListWithoutRetrying() {
        when(settingsService.getString(ConfigKeys.IPO_IPOGURU_BASE_URL)).thenReturn(BASE_URL);
        String errorBody = "{\"message\":\"Rate limit exceeded\",\"retry_after\":60}";
        WebClientResponseException rateLimited = WebClientResponseException.create(
                429, "Too Many Requests", HttpHeaders.EMPTY, errorBody.getBytes(StandardCharsets.UTF_8), null);
        when(httpClient.get(eq(BASE_URL + "/ipos"), any()))
                .thenThrow(new SourceFetchException("HTTP 429 for GET " + BASE_URL + "/ipos", rateLimited));

        List<IpoDto> result = newSource("test-key").fetchAll();

        assertThat(result).isEmpty();
        // Never retried in-process for a 429 — one call only, per the documented "plain failure" contract.
        verify(httpClient, times(1)).get(eq(BASE_URL + "/ipos"), any());
    }

    @Test
    void fetchAll_httpTooManyRequestsWithResetsAtBody_returnsEmptyList() {
        when(settingsService.getString(ConfigKeys.IPO_IPOGURU_BASE_URL)).thenReturn(BASE_URL);
        String errorBody = "{\"message\":\"Daily quota exhausted\",\"resets_at\":\"2026-04-24T00:00:00Z\"}";
        WebClientResponseException rateLimited = WebClientResponseException.create(
                429, "Too Many Requests", HttpHeaders.EMPTY, errorBody.getBytes(StandardCharsets.UTF_8), null);
        when(httpClient.get(eq(BASE_URL + "/ipos"), any()))
                .thenThrow(new SourceFetchException("HTTP 429 for GET " + BASE_URL + "/ipos", rateLimited));

        List<IpoDto> result = newSource("test-key").fetchAll();

        assertThat(result).isEmpty();
    }
}
