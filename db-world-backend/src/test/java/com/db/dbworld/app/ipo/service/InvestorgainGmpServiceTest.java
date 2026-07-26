package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.ipo.entity.IpoGmpHistoryEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoGmpHistoryRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.source.support.IpoHttpClient;
import com.db.dbworld.app.ipo.source.support.IpoHttpResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvestorgainGmpServiceTest {

    @Mock IpoHttpClient httpClient;
    @Mock IpoListingRepository listingRepo;
    @Mock IpoGmpHistoryRepository gmpHistoryRepo;
    @Mock IpoSourcePollService pollService;
    // Unstubbed on purpose: getString(...) returns null → baseUrl() uses the built-in default, so
    // the report/GMP URLs below stay exactly as before.
    @Mock SettingsService settingsService;

    // FY report list URL for the fixed test clock (26-Jul-2026 IST → FY 2026-27).
    private static final String LIST_URL = "https://webnodejs.investorgain.com/cloud/v2/report/data-read/394/1/7/2026/2026-27/0/all";
    private static final String GMP_URL_XTRANET = "https://webnodejs.investorgain.com/cloud/v2/ipo/ipo-gmp-read/1951/true";

    // Real investorgain shapes (trimmed): FY report list (one row) + day-wise GMP for one IPO.
    private static final String LIST_JSON = """
            {"msg":1,"reportTableData":[
              {"~id":1951,"IPO":"Xtranet Technologies","~Srt_Open":"2026-07-23","IPO Price":"₹ 127","Lot":110,
               "Status":"<span>Open</span>","IPO Size":"&#8377;166.80 Cr"}
            ],"totalRecords":1,"totalPages":1}
            """;
    private static final String GMP_JSON = """
            {"msg":1,"ipoGmpData":[
              {"gmp_date":"26-07-2026","gmp":"9","max_ipo_price":"127.00","gmp_active_record_flag":1},
              {"gmp_date":"25-07-2026","gmp":"7.5","max_ipo_price":"127.00","gmp_active_record_flag":0}
            ]}
            """;

    private InvestorgainGmpService newService() {
        return new InvestorgainGmpService(httpClient, listingRepo, gmpHistoryRepo, new IpoNormalizer(),
                pollService, settingsService, Clock.fixed(Instant.parse("2026-07-26T13:00:00Z"), ZoneOffset.UTC));
    }

    private static IpoHttpResponse ok(String body) {
        return new IpoHttpResponse(body, new HttpHeaders());
    }

    @Test
    void parseListings_mapsIdCompanyAndOpenDate() {
        List<InvestorgainGmpService.Listing> listings = newService().parseListings(LIST_JSON);

        assertThat(listings).hasSize(1);
        assertThat(listings.get(0).id()).isEqualTo("1951");
        assertThat(listings.get(0).companyName()).isEqualTo("Xtranet Technologies");
        assertThat(listings.get(0).openDate()).isEqualTo(LocalDate.of(2026, 7, 23));
    }

    @Test
    void parseGmpPoints_parsesDatesAndComputesPctFromGmpOverPrice() {
        List<InvestorgainGmpService.GmpPoint> points = newService().parseGmpPoints(GMP_JSON);

        assertThat(points).hasSize(2);
        assertThat(points.get(0).date()).isEqualTo(LocalDate.of(2026, 7, 26));
        assertThat(points.get(0).gmp()).isEqualByComparingTo("9");
        assertThat(points.get(0).gmpPct()).isEqualByComparingTo("7.09"); // 9 / 127 * 100
        assertThat(points.get(1).date()).isEqualTo(LocalDate.of(2026, 7, 25));
        assertThat(points.get(1).gmpPct()).isEqualByComparingTo("5.91"); // 7.5 / 127 * 100
    }

    @Test
    void refreshGmp_backfillsEveryDayAndStampsLatestOntoListing() {
        stubLists();
        when(httpClient.get(eq(GMP_URL_XTRANET), any())).thenReturn(ok(GMP_JSON));
        IpoListingEntity entity = IpoListingEntity.builder().id("ipo-1").build();
        when(listingRepo.findByMatchKey("xtranet technologies|2026-07-23")).thenReturn(Optional.of(entity));
        when(gmpHistoryRepo.findByIpoIdOrderByCapturedAtAsc("ipo-1")).thenReturn(List.of());

        int updated = newService().refreshGmp();

        assertThat(updated).isEqualTo(1);
        // Two new history rows (26th + 25th), each with the computed pct.
        ArgumentCaptor<IpoGmpHistoryEntity> saved = ArgumentCaptor.forClass(IpoGmpHistoryEntity.class);
        verify(gmpHistoryRepo, org.mockito.Mockito.times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(IpoGmpHistoryEntity::getCapturedAt)
                .containsExactlyInAnyOrder(
                        LocalDate.of(2026, 7, 26).atStartOfDay(ZoneOffset.UTC).toInstant(),
                        LocalDate.of(2026, 7, 25).atStartOfDay(ZoneOffset.UTC).toInstant());
        assertThat(saved.getAllValues()).allSatisfy(row -> assertThat(row.getSource()).isEqualTo("investorgain"));

        // Latest day (26th) stamped onto the listing.
        assertThat(entity.getGmp()).isEqualByComparingTo("9");
        assertThat(entity.getGmpPct()).isEqualByComparingTo("7.09");
        verify(listingRepo).save(entity);
        verify(pollService).recordSuccess(eq("investorgain"), any());
    }

    @Test
    void refreshGmp_skipsDaysAlreadyStored() {
        stubLists();
        when(httpClient.get(eq(GMP_URL_XTRANET), any())).thenReturn(ok(GMP_JSON));
        IpoListingEntity entity = IpoListingEntity.builder().id("ipo-1").build();
        when(listingRepo.findByMatchKey("xtranet technologies|2026-07-23")).thenReturn(Optional.of(entity));
        // The 26th is already stored with the same GMP → only the 25th should be inserted.
        IpoGmpHistoryEntity existing = IpoGmpHistoryEntity.builder()
                .ipoId("ipo-1").gmp(new java.math.BigDecimal("9")).gmpPct(new java.math.BigDecimal("7.09"))
                .source("investorgain").capturedAt(LocalDate.of(2026, 7, 26).atStartOfDay(ZoneOffset.UTC).toInstant())
                .build();
        when(gmpHistoryRepo.findByIpoIdOrderByCapturedAtAsc("ipo-1")).thenReturn(List.of(existing));

        newService().refreshGmp();

        ArgumentCaptor<IpoGmpHistoryEntity> saved = ArgumentCaptor.forClass(IpoGmpHistoryEntity.class);
        verify(gmpHistoryRepo).save(saved.capture());
        assertThat(saved.getValue().getCapturedAt())
                .isEqualTo(LocalDate.of(2026, 7, 25).atStartOfDay(ZoneOffset.UTC).toInstant());
    }

    @Test
    void refreshGmp_untrackedIpo_spendsNoGmpFetch() {
        stubLists();
        when(listingRepo.findByMatchKey("xtranet technologies|2026-07-23")).thenReturn(Optional.empty());

        int updated = newService().refreshGmp();

        assertThat(updated).isZero();
        verify(httpClient, never()).get(contains("ipo-gmp-read"), any());
        verify(pollService).recordSuccess(eq("investorgain"), any());
    }

    private void stubLists() {
        when(httpClient.get(eq(LIST_URL), any())).thenReturn(ok(LIST_JSON));
    }
}
