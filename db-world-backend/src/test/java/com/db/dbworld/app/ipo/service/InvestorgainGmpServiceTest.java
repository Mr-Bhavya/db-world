package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.ipo.dto.SubscriptionCategoryDto;
import com.db.dbworld.app.ipo.entity.IpoGmpHistoryEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoGmpHistoryRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.repository.IpoSubscriptionHistoryRepository;
import com.db.dbworld.app.ipo.source.support.IpoHttpClient;
import com.db.dbworld.app.ipo.source.support.IpoHttpResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
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
    @Mock IpoSubscriptionHistoryRepository subHistoryRepo;
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
              {"~id":1951,"IPO":"Xtranet Technologies","~Srt_Open":"2026-07-23","~Srt_BoA_Dt":"2026-07-28",
               "IPO Price":"₹ 127","Lot":110,"Status":"<span>Open</span>","IPO Size":"&#8377;166.80 Cr"}
            ],"totalRecords":1,"totalPages":1}
            """;
    private static final String GMP_JSON = """
            {"msg":1,"ipoGmpData":[
              {"gmp_date":"26-07-2026","gmp":"9","max_ipo_price":"127.00","gmp_active_record_flag":1},
              {"gmp_date":"25-07-2026","gmp":"7.5","max_ipo_price":"127.00","gmp_active_record_flag":0}
            ]}
            """;
    // One day of the ipo-subscription-read shape (Indo-MIM Day 3): all categories present except
    // Shareholder/Other (offered = 0, so excluded); NII split into Small/Big.
    private static final String SUB_JSON = """
            {"msg":1,"data":{"ipoBiddingData":[
              {"bid_date":"27th Jul 2026 18:56",
               "qib_offered":"1,56,74,494","nii_offered":"1,17,60,045","nii_offered_big":"78,40,030",
               "nii_offered_small":"39,20,015","rii_offered":"2,74,40,105","emp_offered":"2,00,000",
               "shareholder_offered":"0","other_offered":"0",
               "qib_shares_bid_for":"3,20,48,97,090","qib_bid_amt":"1,55,437.51",
               "qib":"204.47","nii":"50.65","nii_big":"57.69","nii_small":"36.55","rii":"6.69","emp":"9.44",
               "shareholder":"0","other":"0","total":"72.37","create_date":"2026-07-27T19:05:00.000Z"}
            ]}}
            """;

    private InvestorgainGmpService newService() {
        return new InvestorgainGmpService(httpClient, listingRepo, gmpHistoryRepo, subHistoryRepo, new InvestorgainMatcher(listingRepo, new IpoNormalizer()),
                pollService, settingsService, Clock.fixed(Instant.parse("2026-07-26T13:00:00Z"), ZoneOffset.UTC));
    }

    private static IpoHttpResponse ok(String body) {
        return new IpoHttpResponse(body, new HttpHeaders());
    }

    /**
     * Stub the tracked-listing set. Matching is now done in memory against every tracked listing
     * (one query, fuzzy comparison) rather than by looking up the exact stored matchKey, because
     * investorgain abbreviates and re-punctuates company names.
     */
    private void tracked(IpoListingEntity... entities) {
        when(listingRepo.findAll()).thenReturn(List.of(entities));
    }

    /** A tracked listing that {@code isWorthFetching} accepts (no listing date = still live). */
    private static IpoListingEntity live(String id, String companyName, LocalDate openDate) {
        return IpoListingEntity.builder().id(id).companyName(companyName).openDate(openDate).build();
    }

    @Test
    void parseListings_mapsIdCompanyAndOpenDate() {
        List<InvestorgainGmpService.Listing> listings = newService().parseListings(LIST_JSON);

        assertThat(listings).hasSize(1);
        assertThat(listings.get(0).id()).isEqualTo("1951");
        assertThat(listings.get(0).companyName()).isEqualTo("Xtranet Technologies");
        assertThat(listings.get(0).openDate()).isEqualTo(LocalDate.of(2026, 7, 23));
        assertThat(listings.get(0).boaDate()).isEqualTo(LocalDate.of(2026, 7, 28));
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

    // Three rows in the report's own order — the OLDEST issue first, which is the order that used
    // to decide who got the fetch budget.
    private static final String LIST_JSON_THREE_ROWS = """
            {"msg":1,"reportTableData":[
              {"~id":100,"IPO":"April Oldco","~Srt_Open":"2026-04-02"},
              {"~id":300,"IPO":"August Newco","~Srt_Open":"2026-08-05"},
              {"~id":200,"IPO":"July Midco","~Srt_Open":"2026-07-23"}
            ],"totalRecords":3,"totalPages":1}
            """;

    private static String gmpUrl(String id) {
        return "https://webnodejs.investorgain.com/cloud/v2/ipo/ipo-gmp-read/" + id + "/true";
    }

    @Test
    void refreshGmp_spendsTheFetchBudgetNewestOpenDateFirst() {
        // The report spans a whole financial year, so the matched set routinely exceeds the 30-fetch
        // budget. Following the report's own row order meant the budget could be consumed entirely by
        // issues that listed months ago, leaving the currently-open and just-listed ones — the ones
        // actually on screen — with no GMP and no subscription at all. Newest open date first.
        when(httpClient.get(eq(LIST_URL), any())).thenReturn(ok(LIST_JSON_THREE_ROWS));
        when(httpClient.get(contains("ipo-gmp-read"), any())).thenReturn(ok("""
                {"msg":1,"ipoGmpData":[]}
                """));
        tracked(live("ipo-old", "April Oldco Limited", LocalDate.of(2026, 4, 2)),
                live("ipo-new", "August Newco Limited", LocalDate.of(2026, 8, 5)),
                live("ipo-mid", "July Midco Limited", LocalDate.of(2026, 7, 23)));

        newService().refreshGmp();

        InOrder inOrder = org.mockito.Mockito.inOrder(httpClient);
        inOrder.verify(httpClient).get(eq(gmpUrl("300")), any());  // opens 05-Aug
        inOrder.verify(httpClient).get(eq(gmpUrl("200")), any());  // opens 23-Jul
        inOrder.verify(httpClient).get(eq(gmpUrl("100")), any());  // opens 02-Apr, last
    }

    @Test
    void refreshGmp_feedTruncatesTheCompanyName_stillMatchesOnPrefix() {
        // Real capture: investorgain's report says "Skyways Air" / "Gaja Alternative Asset" where we
        // store "Skyways Air Services Limited" / "Gaja Alternative Asset Management Ltd.". The feed
        // name is a PREFIX of ours, never equal, so an exact match left those IPOs with no GMP and no
        // subscription at all — indistinguishable from "the feed doesn't have it".
        when(httpClient.get(eq(LIST_URL), any())).thenReturn(ok("""
                {"msg":1,"reportTableData":[
                  {"~id":1951,"IPO":"Skyways Air","~Srt_Open":"2026-08-24"}
                ],"totalRecords":1,"totalPages":1}
                """));
        when(httpClient.get(eq(GMP_URL_XTRANET), any())).thenReturn(ok(GMP_JSON));
        IpoListingEntity entity = live("ipo-1", "Skyways Air Services Limited", LocalDate.of(2026, 8, 24));
        tracked(entity);
        when(gmpHistoryRepo.findByIpoIdOrderByCapturedAtAsc("ipo-1")).thenReturn(List.of());

        assertThat(newService().refreshGmp()).isEqualTo(1);
        assertThat(entity.getGmp()).isEqualByComparingTo("9");
    }

    @Test
    void refreshGmp_namesDifferOnlyByPunctuationSpacing_stillMatches() {
        // Real capture: "G.V. Electricals" vs our "G.V.Electricals Ltd.". Stripping only
        // non-alphanumerics leaves "gv electricals" against "gvelectricals" — the SPACE is the entire
        // difference, so the comparison key has to drop whitespace too.
        when(httpClient.get(eq(LIST_URL), any())).thenReturn(ok("""
                {"msg":1,"reportTableData":[
                  {"~id":1951,"IPO":"G.V. Electricals","~Srt_Open":"2026-07-31"}
                ],"totalRecords":1,"totalPages":1}
                """));
        when(httpClient.get(eq(GMP_URL_XTRANET), any())).thenReturn(ok(GMP_JSON));
        IpoListingEntity entity = live("ipo-1", "G.V.Electricals Ltd.", LocalDate.of(2026, 7, 31));
        tracked(entity);
        when(gmpHistoryRepo.findByIpoIdOrderByCapturedAtAsc("ipo-1")).thenReturn(List.of());

        assertThat(newService().refreshGmp()).isEqualTo(1);
    }

    @Test
    void refreshGmp_prefixHitsSeveralTrackedIpos_disambiguatedByOpenDate() {
        when(httpClient.get(eq(LIST_URL), any())).thenReturn(ok("""
                {"msg":1,"reportTableData":[
                  {"~id":1951,"IPO":"Shree Balaji","~Srt_Open":"2026-07-22"}
                ],"totalRecords":1,"totalPages":1}
                """));
        when(httpClient.get(eq(GMP_URL_XTRANET), any())).thenReturn(ok(GMP_JSON));
        IpoListingEntity wanted = live("ipo-mala", "Shree Balaji Mala Limited", LocalDate.of(2026, 7, 22));
        tracked(live("ipo-other", "Shree Balaji Steels Limited", LocalDate.of(2026, 3, 4)), wanted);
        when(gmpHistoryRepo.findByIpoIdOrderByCapturedAtAsc("ipo-mala")).thenReturn(List.of());

        assertThat(newService().refreshGmp()).isEqualTo(1);
        assertThat(wanted.getGmp()).isEqualByComparingTo("9");
    }

    @Test
    void refreshGmp_ambiguousEvenOnOpenDate_skippedRatherThanMisattributed() {
        when(httpClient.get(eq(LIST_URL), any())).thenReturn(ok("""
                {"msg":1,"reportTableData":[
                  {"~id":1951,"IPO":"Shree Balaji","~Srt_Open":"2026-07-22"}
                ],"totalRecords":1,"totalPages":1}
                """));
        tracked(live("ipo-a", "Shree Balaji Mala Limited", LocalDate.of(2026, 7, 22)),
                live("ipo-b", "Shree Balaji Steels Limited", LocalDate.of(2026, 7, 22)));

        assertThat(newService().refreshGmp()).isZero();
        verify(httpClient, never()).get(eq(GMP_URL_XTRANET), any());
    }

    @Test
    void refreshGmp_ipoListedLongAgo_costsNoFetch() {
        // The budget starvation fix: the report spans a financial year, so ~155 tracked IPOs matched
        // against 30 fetches and the ones on screen got nothing. Anything the list already hides is
        // not worth a call.
        when(httpClient.get(eq(LIST_URL), any())).thenReturn(ok(LIST_JSON));
        when(settingsService.getLong(ConfigKeys.IPO_LIST_HIDE_LISTED_AFTER_DAYS)).thenReturn(30L);
        tracked(IpoListingEntity.builder().id("ipo-1").companyName("Xtranet Technologies Limited")
                .openDate(LocalDate.of(2026, 7, 23))
                .listingDate(LocalDate.of(2026, 3, 1)) // listed ~5 months before the test clock
                .build());

        assertThat(newService().refreshGmp()).isZero();
        verify(httpClient, never()).get(eq(GMP_URL_XTRANET), any());
    }

    @Test
    void refreshGmp_untrackedRowsCostNoHttpCall() {
        // The match-then-order pass must still resolve tracked listings first, so an IPO we don't
        // track never consumes a slot of the budget.
        when(httpClient.get(eq(LIST_URL), any())).thenReturn(ok(LIST_JSON_THREE_ROWS));
        when(httpClient.get(contains("ipo-gmp-read"), any())).thenReturn(ok("""
                {"msg":1,"ipoGmpData":[]}
                """));
        tracked(live("ipo-mid", "July Midco Limited", LocalDate.of(2026, 7, 23)));

        newService().refreshGmp();

        verify(httpClient).get(eq(gmpUrl("200")), any());
        verify(httpClient, never()).get(eq(gmpUrl("100")), any());
        verify(httpClient, never()).get(eq(gmpUrl("300")), any());
    }

    @Test
    void refreshGmp_backfillsEveryDayAndStampsLatestOntoListing() {
        stubLists();
        when(httpClient.get(eq(GMP_URL_XTRANET), any())).thenReturn(ok(GMP_JSON));
        IpoListingEntity entity = live("ipo-1", "Xtranet Technologies Limited", LocalDate.of(2026, 7, 23));
        tracked(entity);
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
        tracked(live("ipo-1", "Xtranet Technologies Limited", LocalDate.of(2026, 7, 23)));
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
        tracked();

        int updated = newService().refreshGmp();

        assertThat(updated).isZero();
        verify(httpClient, never()).get(contains("ipo-gmp-read"), any());
        verify(pollService).recordSuccess(eq("investorgain"), any());
    }

    @Test
    void parseSubscriptionPoints_mapsPresentCategoriesInOrderAndSkipsAbsentOnes() {
        List<InvestorgainGmpService.SubPoint> points = newService().parseSubscriptionPoints(SUB_JSON);

        assertThat(points).hasSize(1);
        InvestorgainGmpService.SubPoint p = points.get(0);
        assertThat(p.capturedAt())
                .isEqualTo(LocalDate.of(2026, 7, 27).atStartOfDay(ZoneOffset.UTC).toInstant());
        assertThat(p.total()).isEqualByComparingTo("72.37");
        // Present categories in display order; Shareholder/Other dropped (offered = 0).
        assertThat(p.categories().keySet()).containsExactly("QIB", "NII", "S-NII", "B-NII", "RII", "Employee");
        assertThat(p.categories().get("QIB")).isEqualByComparingTo("204.47");
        assertThat(p.categories().get("S-NII")).isEqualByComparingTo("36.55");
        assertThat(p.categories().get("B-NII")).isEqualByComparingTo("57.69");
        assertThat(p.categories()).doesNotContainKeys("Shareholder", "Other");

        // Full per-category breakdown (offered/bid/amount), same order, comma-grouped numbers parsed.
        assertThat(p.detail()).extracting(SubscriptionCategoryDto::category)
                .containsExactly("QIB", "NII", "S-NII", "B-NII", "RII", "Employee");
        SubscriptionCategoryDto qib = p.detail().get(0);
        assertThat(qib.times()).isEqualByComparingTo("204.47");
        assertThat(qib.sharesOffered()).isEqualByComparingTo("15674494");   // 1,56,74,494
        assertThat(qib.sharesBid()).isEqualByComparingTo("3204897090");     // 3,20,48,97,090
        assertThat(qib.bidAmountCr()).isEqualByComparingTo("155437.51");    // 1,55,437.51
    }

    private void stubLists() {
        when(httpClient.get(eq(LIST_URL), any())).thenReturn(ok(LIST_JSON));
    }
}
