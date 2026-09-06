package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.entity.IpoChangeEventEntity;
import com.db.dbworld.app.ipo.repository.IpoChangeEventRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
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
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Fixtures are trimmed but VERBATIM rows from a live capture — the HTML-in-JSON cells are the
 * fragile part of this adapter, so they're exercised exactly as investorgain sends them (malformed
 * {@code \"\"} attributes and all).
 */
@ExtendWith(MockitoExtension.class)
class InvestorgainLiveServiceTest {

    @Mock IpoHttpClient httpClient;
    @Mock IpoListingRepository listingRepo;
    @Mock IpoChangeEventRepository changeEventRepo;
    @Mock IpoSourcePollService pollService;
    @Mock SettingsService settingsService;

    /** 27-Aug-2026 ~20:00 IST → month 8, FY 2026-27. */
    private static final Instant NOW = Instant.parse("2026-08-27T14:30:00Z");

    private InvestorgainLiveService newService() {
        return new InvestorgainLiveService(httpClient, listingRepo, changeEventRepo,
                new InvestorgainMatcher(listingRepo, new IpoNormalizer()), pollService, settingsService,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static IpoHttpResponse ok(String body) {
        return new IpoHttpResponse(body, new HttpHeaders());
    }

    /** An OPEN row (Lumino) and an already-LISTED row (Gaja, carrying {@code L@185.00 (15.62%)}). */
    private static final String REPORT_JSON = """
            {"msg":1,"reportTableData":[
              {"~orderby1":7400,"~ipo_status1":"O","~ipo_category1":"IPO","~max_gmp1":"55",
               "Name":"<a href=\\"/gmp/lumino-industries-ipo/1619/\\" title=\\"Lumino Industries\\" target=\\"_parent\\">Lumino Industries</a> <span class=\\"badge rounded-pill bg-success d-inline ms-2\\">O</span>",
               "GMP":"&#8377;<b>55</b> (67.07%)<br><small style=\\"font-size: 12px; color: #007BFF;\\"\\"><b>46 \\u2193 / 55 \\u2191</b></small>",
               "Rating":"<span style='font-size: 12px;'>&#128293;&#128293;&#128293;&#128293;&#128293;</span>",
               "Sub":"1.51x","Price (\\u20b9)":"82","IPO Size":"&#8377;300.00 Cr","Lot":"182","~P/E":"33.12",
               "~id":1619,"Open":"27-Aug","Close":"31-Aug","BoA Dt":"1-Sep","Listing":"3-Sep",
               "Updated-On":"<small style=\\"font-size: 12px; color: #007BFF;\\"><b>27-Aug 20:02</b></small>",
               "Anchor":"<span style=\\"color:green;font-weight:bold;\\">\\u2705</span>",
               "~Srt_Open":"2026-08-27","~Srt_Close":"2026-08-31","~Srt_BoA_Dt":"2026-09-01",
               "~Str_Listing":"2026-09-03","~gmp_percent_calc":"67.07","~ipo_name":"Lumino Industries"},
              {"~orderby1":7310,"~ipo_status1":"LP","~ipo_category1":"IPO","~max_gmp1":"30",
               "Name":"<a href=\\"/gmp/gaja-alternative-asset-management-ipo/1828/\\" title=\\"Gaja\\" target=\\"_parent\\">Gaja Alternative Asset Management</a> <span class='text-success d-inline ms-2'><small style=\\"font-size: 12px;\\"><b>L@185.00 (15.62%)</b></small></span>",
               "GMP":"&#8377;<b>18.5</b> (11.56%)<br><small><b>7 \\u2193 / 30 \\u2191</b></small>",
               "Rating":"<span style='font-size: 12px;'>&#128293;&#128293;&#128293;</span>",
               "Sub":"32.98x","Price (\\u20b9)":"160","IPO Size":"&#8377;500.00 Cr","Lot":"93","~P/E":"--",
               "~id":1828,"Updated-On":"<small><b>26-Aug 9:37</b></small>",
               "Anchor":"<span style=\\"color:red;font-weight:bold;\\">\\u274c</span>",
               "~Srt_Open":"2026-08-19","~Srt_Close":"2026-08-21","~Srt_BoA_Dt":"2026-08-22",
               "~Str_Listing":"2026-08-26","~ipo_name":"Gaja Alternative Asset Management"}
            ],"totalRecords":2,"totalPages":1}
            """;

    private static final String DASHBOARD_JSON = """
            {"msg":1,"gmpList":[
              {"company_short_name":"Lumino Industries","gmp":"55","gmp_rating":5,"subscription":"1.51x",
               "href":"/ipo/lumino-industries-ipo/1619/","allotment_link":"https://linkintime.co.in/Initial_Offer/public-issues.html",
               "company_sector":"Electrical Equipment","price_band":"78-82",
               "logo_url":"lumino-industries-ipo-logo.png"}
            ]}
            """;

    private void stubFeeds() {
        when(httpClient.get(contains("data-read/331"), any())).thenReturn(ok(REPORT_JSON));
        when(httpClient.get(contains("index/gmp-data"), any())).thenReturn(ok(DASHBOARD_JSON));
    }

    @Test
    void liveReportUrl_carriesTheCurrentIstMonthAndFinancialYear() {
        // The third path segment is the calendar MONTH — the response echoes it back in its own
        // cacheKey ("ig_report_v2:331:all:1::2026:8:2026-27:"). Pinning it to a constant, as the
        // sibling report templates used to, asks for the wrong month all year.
        assertThat(newService().liveReportUrl())
                .isEqualTo("https://webnodejs.investorgain.com/cloud/v2/report/data-read/331/1/8/2026/2026-27/0/all?search=");
    }

    @Test
    void parseLiveReport_decodesTheHtmlCellsOfAnOpenRow() {
        List<InvestorgainLiveService.LiveRow> rows = newService().parseLiveReport(REPORT_JSON);

        assertThat(rows).hasSize(2);
        InvestorgainLiveService.LiveRow lumino = rows.get(0);
        assertThat(lumino.id()).isEqualTo(1619);
        assertThat(lumino.companyName()).isEqualTo("Lumino Industries");
        assertThat(lumino.gmp()).isEqualByComparingTo("55");
        assertThat(lumino.gmpPct()).isEqualByComparingTo("67.07");   // theirs, not computed
        assertThat(lumino.gmpMin()).isEqualByComparingTo("46");      // the "46 ↓ / 55 ↑" range
        assertThat(lumino.gmpMax()).isEqualByComparingTo("55");
        assertThat(lumino.gmpRating()).isEqualTo(5);                 // five fire emoji
        assertThat(lumino.subTotal()).isEqualByComparingTo("1.51");
        assertThat(lumino.capPrice()).isEqualByComparingTo("82");
        assertThat(lumino.lotSize()).isEqualTo(182);
        assertThat(lumino.peRatio()).isEqualByComparingTo("33.12");
        assertThat(lumino.anchorInvestor()).isTrue();
        assertThat(lumino.gmpUpdatedLabel()).isEqualTo("27-Aug 20:02");
        assertThat(lumino.openDate()).isEqualTo(LocalDate.of(2026, 8, 27));
        assertThat(lumino.listingDate()).isEqualTo(LocalDate.of(2026, 9, 3));
        // Not listed yet, so no listing figures.
        assertThat(lumino.listingPrice()).isNull();
        assertThat(lumino.listingGainPct()).isNull();
    }

    @Test
    void parseLiveReport_readsListingPriceAndGainOutOfTheNameCell() {
        // This is the whole reason a listed IPO had an empty listing price and no gain pill: the two
        // values exist ONLY as "L@185.00 (15.62%)" inside the name cell's markup. Nothing else in
        // any source reports them, so with this they stop being derived from the price band.
        InvestorgainLiveService.LiveRow gaja = newService().parseLiveReport(REPORT_JSON).get(1);

        assertThat(gaja.id()).isEqualTo(1828);
        assertThat(gaja.listingPrice()).isEqualByComparingTo("185.00");
        assertThat(gaja.listingGainPct()).isEqualByComparingTo("15.62");
        assertThat(gaja.anchorInvestor()).isFalse();
        assertThat(gaja.lotSize()).isEqualTo(93);
        assertThat(gaja.peRatio()).isNull();  // their "--" placeholder is not a number
    }

    @Test
    void parseDashboard_keysRowsByTheIdInTheirHref() {
        Map<Integer, InvestorgainLiveService.DashboardRow> byId = newService().parseDashboard(DASHBOARD_JSON);

        assertThat(byId).containsOnlyKeys(1619);
        InvestorgainLiveService.DashboardRow row = byId.get(1619);
        assertThat(row.priceMin()).isEqualByComparingTo("78");   // the band report 331 omits
        assertThat(row.priceMax()).isEqualByComparingTo("82");
        assertThat(row.sector()).isEqualTo("Electrical Equipment");
        assertThat(row.allotmentLink()).contains("linkintime.co.in");
        assertThat(row.gmpRating()).isEqualTo(5);
        // A bare filename — investorgain serves its images off Chittorgarh's CDN, so the host has
        // to be prepended before it's any use as an <img> src.
        assertThat(row.logoUrl())
                .isEqualTo("https://www.chittorgarh.net/images/ipo/lumino-industries-ipo-logo.png");
    }

    @Test
    void refresh_logoOnlyFillsAGap_neverOverwritesChittorgarhs() {
        stubFeeds();
        IpoListingEntity withLogo = IpoListingEntity.builder()
                .id("ipo-1").companyName("Lumino Industries Limited").investorgainId(1619)
                .logoUrl("https://www.chittorgarh.net/images/ipo/existing.png")
                .estimatedListingPrice(java.math.BigDecimal.ONE)
                .build();
        when(listingRepo.findAll()).thenReturn(List.of(withLogo));

        newService().refresh();

        assertThat(withLogo.getLogoUrl()).endsWith("existing.png");
    }

    @Test
    void refresh_noLogoStored_takesInvestorgains() {
        stubFeeds();
        IpoListingEntity noLogo = IpoListingEntity.builder()
                .id("ipo-1").companyName("Lumino Industries Limited").investorgainId(1619)
                .estimatedListingPrice(java.math.BigDecimal.ONE)
                .build();
        when(listingRepo.findAll()).thenReturn(List.of(noLogo));

        newService().refresh();

        assertThat(noLogo.getLogoUrl()).endsWith("lumino-industries-ipo-logo.png");
    }

    @Test
    void refresh_overwritesTheVolatileNumbersAndLearnsTheInvestorgainId() {
        stubFeeds();
        IpoListingEntity lumino = IpoListingEntity.builder()
                .id("ipo-1").companyName("Lumino Industries Limited")
                .openDate(LocalDate.of(2026, 8, 27))
                .gmp(new java.math.BigDecimal("40")).subTotal(new java.math.BigDecimal("0.90"))
                .build();
        when(listingRepo.findAll()).thenReturn(List.of(lumino));

        assertThat(newService().refresh()).isEqualTo(1);

        assertThat(lumino.getGmp()).isEqualByComparingTo("55");
        assertThat(lumino.getGmpPct()).isEqualByComparingTo("67.07");
        assertThat(lumino.getSubTotal()).isEqualByComparingTo("1.51");
        assertThat(lumino.getLotSize()).isEqualTo(182);
        assertThat(lumino.getGmpRating()).isEqualTo(5);
        assertThat(lumino.getPeRatio()).isEqualByComparingTo("33.12");
        assertThat(lumino.getAnchorInvestor()).isTrue();
        assertThat(lumino.getAllotmentLink()).contains("linkintime.co.in");
        // Matched by name once, then pinned by id so the short-name comparison never runs again.
        assertThat(lumino.getInvestorgainId()).isEqualTo(1619);
        verify(listingRepo).save(lumino);
        verify(pollService).recordSuccess(eq("investorgain"), any());
    }

    @Test
    void refresh_doesNotOverwriteNseDatesOrPriceBand() {
        // Agreed precedence: investorgain wins the volatile numbers, NSE stays the exchange of record
        // for dates and pricing — so those are only ever gap-filled.
        stubFeeds();
        IpoListingEntity lumino = IpoListingEntity.builder()
                .id("ipo-1").companyName("Lumino Industries Limited")
                .openDate(LocalDate.of(2026, 8, 26))                     // deliberately different
                .priceMin(new java.math.BigDecimal("79"))
                .priceMax(new java.math.BigDecimal("83"))
                .investorgainId(1619)
                .build();
        when(listingRepo.findAll()).thenReturn(List.of(lumino));

        newService().refresh();

        assertThat(lumino.getOpenDate()).isEqualTo(LocalDate.of(2026, 8, 26));
        assertThat(lumino.getPriceMin()).isEqualByComparingTo("79");
        assertThat(lumino.getPriceMax()).isEqualByComparingTo("83");
    }

    @Test
    void refresh_fillsDatesAndBandOnlyWhenWeHaveNone() {
        stubFeeds();
        IpoListingEntity lumino = IpoListingEntity.builder()
                .id("ipo-1").companyName("Lumino Industries Limited").investorgainId(1619).build();
        when(listingRepo.findAll()).thenReturn(List.of(lumino));

        newService().refresh();

        assertThat(lumino.getOpenDate()).isEqualTo(LocalDate.of(2026, 8, 27));
        assertThat(lumino.getAllotmentDate()).isEqualTo(LocalDate.of(2026, 9, 1));
        assertThat(lumino.getPriceMin()).isEqualByComparingTo("78");
        assertThat(lumino.getPriceMax()).isEqualByComparingTo("82");
        assertThat(lumino.getSector()).isEqualTo("Electrical Equipment");
    }

    @Test
    void refresh_unchangedFeed_writesNothing() {
        stubFeeds();
        IpoListingEntity lumino = IpoListingEntity.builder()
                .id("ipo-1").companyName("Lumino Industries Limited").investorgainId(1619)
                .openDate(LocalDate.of(2026, 8, 27)).closeDate(LocalDate.of(2026, 8, 31))
                .allotmentDate(LocalDate.of(2026, 9, 1)).listingDate(LocalDate.of(2026, 9, 3))
                .priceMin(new java.math.BigDecimal("78")).priceMax(new java.math.BigDecimal("82"))
                .issueSize("&#8377;300.00 Cr").sector("Electrical Equipment")
                .logoUrl("https://www.chittorgarh.net/images/ipo/lumino-industries-ipo-logo.png")
                .allotmentLink("https://linkintime.co.in/Initial_Offer/public-issues.html")
                .gmp(new java.math.BigDecimal("55")).gmpPct(new java.math.BigDecimal("67.07"))
                .gmpMin(new java.math.BigDecimal("46")).gmpMax(new java.math.BigDecimal("55"))
                .gmpRating(5).subTotal(new java.math.BigDecimal("1.51"))
                .lotSize(182).peRatio(new java.math.BigDecimal("33.12")).anchorInvestor(true)
                .gmpUpdatedLabel("27-Aug 20:02")
                .build();
        when(listingRepo.findAll()).thenReturn(List.of(lumino));

        assertThat(newService().refresh()).isZero();
        verify(listingRepo, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void refresh_dashboardUnavailable_stillAppliesTheReport() {
        // The dashboard is a bonus second call; losing it must only cost the price band and the
        // allotment link, never the GMP/subscription refresh the whole job exists for.
        when(httpClient.get(contains("data-read/331"), any())).thenReturn(ok(REPORT_JSON));
        when(httpClient.get(contains("index/gmp-data"), any()))
                .thenThrow(new RuntimeException("dashboard 503"));
        IpoListingEntity lumino = IpoListingEntity.builder()
                .id("ipo-1").companyName("Lumino Industries Limited").investorgainId(1619).build();
        when(listingRepo.findAll()).thenReturn(List.of(lumino));

        assertThat(newService().refresh()).isEqualTo(1);

        assertThat(lumino.getGmp()).isEqualByComparingTo("55");
        assertThat(lumino.getAllotmentLink()).isNull();
        // 331 reports only the cap, so priceMax can be seeded but priceMin stays unknown.
        assertThat(lumino.getPriceMax()).isEqualByComparingTo("82");
        assertThat(lumino.getPriceMin()).isNull();
    }

    /** The per-IPO GMP detail — the only place the three grey-market estimates appear. */
    private static final String ESTIMATES_JSON = """
            {"msg":1,"key":"ig_ipo_gmp_v2:1619","ipoGmpData":[
              {"Seq":7,"ipo_id":1619,"gmp_date":"27-08-2026","gmp":"55","subject_to_sauda":"7600",
               "max_ipo_price":"82.00","estimated_listing_price":"137","est_profit":"10010",
               "gmp_active_record_flag":1,"total":"1.51","last_updated":"27-Aug-2026 20:02"},
              {"Seq":6,"ipo_id":1619,"gmp_date":"26-08-2026","gmp":"50","subject_to_sauda":"6900",
               "estimated_listing_price":"132","est_profit":"9100","gmp_active_record_flag":0}
            ]}
            """;

    @Test
    void parseEstimates_takesTheRowInvestorgainFlagsAsActive() {
        InvestorgainLiveService.Estimates estimates = newService().parseEstimates(ESTIMATES_JSON);

        // 137 / 7600 / 10010 are theirs — the cap+GMP arithmetic is done upstream, never here.
        assertThat(estimates.estimatedListingPrice()).isEqualByComparingTo("137");
        assertThat(estimates.subjectToSauda()).isEqualByComparingTo("7600");
        assertThat(estimates.estProfit()).isEqualByComparingTo("10010");
    }

    @Test
    void refresh_gmpMoved_fetchesTheEstimatesAndRecordsAGmpChangeEvent() {
        stubFeeds();
        when(httpClient.get(contains("ipo-gmp-read"), any())).thenReturn(ok(ESTIMATES_JSON));
        IpoListingEntity lumino = IpoListingEntity.builder()
                .id("ipo-1").companyName("Lumino Industries Limited").investorgainId(1619)
                .gmp(new java.math.BigDecimal("40"))
                .estimatedListingPrice(new java.math.BigDecimal("122"))
                .build();
        when(listingRepo.findAll()).thenReturn(List.of(lumino));

        newService().refresh();

        assertThat(lumino.getEstimatedListingPrice()).isEqualByComparingTo("137");
        assertThat(lumino.getSubjectToSauda()).isEqualByComparingTo("7600");
        assertThat(lumino.getEstProfit()).isEqualByComparingTo("10010");
        // Whichever tier writes gmp has to record the move, or the "GMP moved" push dies: the poll's
        // own detectChanges compares the feed against the stored value, which this tier already
        // overwrote, so it would always find them equal.
        org.mockito.ArgumentCaptor<IpoChangeEventEntity> events =
                org.mockito.ArgumentCaptor.forClass(IpoChangeEventEntity.class);
        verify(changeEventRepo).save(events.capture());
        assertThat(events.getValue().getEventType()).isEqualTo("GMP");
        assertThat(events.getValue().getOldValue()).isEqualTo("40");
        assertThat(events.getValue().getNewValue()).isEqualTo("55");
        assertThat(events.getValue().getNotifiedAt()).isNull(); // queued for the delivery pass
    }

    @Test
    void refresh_gmpUnchanged_spendsNoEstimateCallAndRaisesNoEvent() {
        // The estimates derive from the GMP, so a quiet tick must cost nothing extra.
        stubFeeds();
        IpoListingEntity lumino = IpoListingEntity.builder()
                .id("ipo-1").companyName("Lumino Industries Limited").investorgainId(1619)
                .gmp(new java.math.BigDecimal("55"))
                .estimatedListingPrice(new java.math.BigDecimal("137"))
                .subjectToSauda(new java.math.BigDecimal("7600"))
                .estProfit(new java.math.BigDecimal("10010"))
                .build();
        when(listingRepo.findAll()).thenReturn(List.of(lumino));

        newService().refresh();

        verify(httpClient, org.mockito.Mockito.never()).get(contains("ipo-gmp-read"), any());
        verify(changeEventRepo, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void refresh_estimatesNeverFetchedBefore_backfillsThemEvenWithAnUnchangedGmp() {
        stubFeeds();
        when(httpClient.get(contains("ipo-gmp-read"), any())).thenReturn(ok(ESTIMATES_JSON));
        IpoListingEntity lumino = IpoListingEntity.builder()
                .id("ipo-1").companyName("Lumino Industries Limited").investorgainId(1619)
                .gmp(new java.math.BigDecimal("55"))
                .build();
        when(listingRepo.findAll()).thenReturn(List.of(lumino));

        newService().refresh();

        assertThat(lumino.getEstProfit()).isEqualByComparingTo("10010");
    }

    @Test
    void refresh_listingPriceArrivesForTheFirstTime_recordsAListingEvent() {
        // Audit-only (the notifier ignores LISTING), but the same blind spot: the poll can no longer
        // see "listing price newly set" once this tier has written it.
        stubFeeds();
        IpoListingEntity gaja = IpoListingEntity.builder()
                .id("ipo-2").companyName("Gaja Alternative Asset Management Ltd.").investorgainId(1828)
                .gmp(new java.math.BigDecimal("18.5")).listingExchange("BOTH")
                .estimatedListingPrice(java.math.BigDecimal.ONE)
                .build();
        when(listingRepo.findAll()).thenReturn(List.of(gaja));

        newService().refresh();

        assertThat(gaja.getListingPrice()).isEqualByComparingTo("185.00");
        org.mockito.ArgumentCaptor<IpoChangeEventEntity> events =
                org.mockito.ArgumentCaptor.forClass(IpoChangeEventEntity.class);
        verify(changeEventRepo).save(events.capture());
        assertThat(events.getValue().getEventType()).isEqualTo("LISTING");
        assertThat(events.getValue().getNewValue()).isEqualTo("BOTH 15.62%");
    }

    @Test
    void refresh_reportFails_recordsFailureAndTouchesNothing() {
        when(httpClient.get(contains("data-read/331"), any())).thenThrow(new RuntimeException("blocked"));

        assertThat(newService().refresh()).isZero();

        verify(pollService).recordFailure(eq("investorgain"), any(), eq("FAILED"));
        verify(listingRepo, org.mockito.Mockito.never()).save(any());
    }
}
