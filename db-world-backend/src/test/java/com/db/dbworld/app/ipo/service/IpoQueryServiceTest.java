package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.GmpPointDto;
import com.db.dbworld.app.ipo.dto.IpoDetailDto;
import com.db.dbworld.app.ipo.dto.IpoFinancialDto;
import com.db.dbworld.app.ipo.dto.IpoListResponse;
import com.db.dbworld.app.ipo.dto.IpoSummaryDto;
import com.db.dbworld.app.ipo.dto.SubscriptionPointDto;
import com.db.dbworld.app.ipo.entity.IpoFinancialEntity;
import com.db.dbworld.app.ipo.entity.IpoGmpHistoryEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.entity.IpoSubscriptionHistoryEntity;
import com.db.dbworld.app.ipo.mapper.IpoMapper;
import com.db.dbworld.app.ipo.repository.IpoFinancialRepository;
import com.db.dbworld.app.ipo.repository.IpoGmpHistoryRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.repository.IpoSubscriptionHistoryRepository;
import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IpoQueryServiceTest {

    private static final Instant LAST_SUCCESS = Instant.parse("2026-07-24T09:00:00Z");

    IpoListingRepository listingRepository;
    IpoGmpHistoryRepository gmpHistoryRepository;
    IpoSubscriptionHistoryRepository subscriptionHistoryRepository;
    IpoFinancialRepository financialRepository;
    IpoSourcePollService pollService;
    IpoQueryService service;

    @BeforeEach
    void setUp() {
        listingRepository = mock(IpoListingRepository.class);
        gmpHistoryRepository = mock(IpoGmpHistoryRepository.class);
        subscriptionHistoryRepository = mock(IpoSubscriptionHistoryRepository.class);
        financialRepository = mock(IpoFinancialRepository.class);
        pollService = mock(IpoSourcePollService.class);
        service = new IpoQueryService(listingRepository, gmpHistoryRepository, subscriptionHistoryRepository,
                financialRepository, pollService, new IpoMapper());
    }

    private IpoListingEntity entity(String id, String status, LocalDate openDate) {
        return entity(id, status, "mainboard", openDate, null, null);
    }

    private IpoListingEntity entity(String id, String status, String ipoType, LocalDate openDate,
                                     BigDecimal gmpPct, BigDecimal subTotal) {
        return IpoListingEntity.builder()
                .id(id)
                .matchKey(id + "-key")
                .companyName("Company " + id)
                .ipoType(ipoType)
                .status(status)
                .openDate(openDate)
                .gmpPct(gmpPct)
                .subTotal(subTotal)
                .build();
    }

    @Test
    void list_blankStatus_usesFindAll() {
        when(listingRepository.findAll()).thenReturn(List.of(entity("1", "open", LocalDate.of(2026, 7, 20))));
        when(pollService.lastSuccessAcrossSources()).thenReturn(Optional.of(LAST_SUCCESS));

        IpoListResponse response = service.list(null, null, null);

        verify(listingRepository).findAll();
        verify(listingRepository, never()).findByStatus(any());
        assertThat(response.ipos()).extracting(IpoSummaryDto::id).containsExactly("1");
        assertThat(response.lastUpdated()).isEqualTo(LAST_SUCCESS);
    }

    @Test
    void list_blankStringStatus_usesFindAll() {
        when(listingRepository.findAll()).thenReturn(List.of());
        when(pollService.lastSuccessAcrossSources()).thenReturn(Optional.empty());

        service.list("   ", null, null);

        verify(listingRepository).findAll();
        verify(listingRepository, never()).findByStatus(any());
    }

    @Test
    void list_withStatus_delegatesToFindByStatus() {
        when(listingRepository.findByStatus("open")).thenReturn(List.of(entity("1", "open", LocalDate.of(2026, 7, 20))));
        when(pollService.lastSuccessAcrossSources()).thenReturn(Optional.of(LAST_SUCCESS));

        IpoListResponse response = service.list("open", null, null);

        verify(listingRepository).findByStatus("open");
        verify(listingRepository, never()).findAll();
        assertThat(response.ipos()).hasSize(1);
        assertThat(response.lastUpdated()).isEqualTo(LAST_SUCCESS);
    }

    @Test
    void list_statusFilterIsCanonicalized_rawSourceCasingStillMatches() {
        // The stored status is always canonical ("open"); a filter value of "Active" (NSE-style
        // raw casing) must canonicalize to "open" before hitting the repository.
        when(listingRepository.findByStatus("open")).thenReturn(List.of(entity("1", "open", LocalDate.of(2026, 7, 20))));
        when(pollService.lastSuccessAcrossSources()).thenReturn(Optional.empty());

        IpoListResponse response = service.list("Active", null, null);

        verify(listingRepository).findByStatus("open");
        assertThat(response.ipos()).hasSize(1);
    }

    @Test
    void list_noSuccessfulPollEver_lastUpdatedIsNull() {
        when(listingRepository.findAll()).thenReturn(List.of());
        when(pollService.lastSuccessAcrossSources()).thenReturn(Optional.empty());

        IpoListResponse response = service.list(null, null, null);

        assertThat(response.lastUpdated()).isNull();
    }

    @Test
    void list_sortsByOpenDateDescendingWithNullsLast() {
        IpoListingEntity older = entity("older", "open", LocalDate.of(2026, 6, 1));
        IpoListingEntity newer = entity("newer", "open", LocalDate.of(2026, 7, 20));
        IpoListingEntity noOpenDate = entity("no-date", "upcoming", null);
        when(listingRepository.findAll()).thenReturn(List.of(older, noOpenDate, newer));
        when(pollService.lastSuccessAcrossSources()).thenReturn(Optional.empty());

        IpoListResponse response = service.list(null, null, null);

        assertThat(response.ipos()).extracting(IpoSummaryDto::id)
                .containsExactly("newer", "older", "no-date");
    }

    @Test
    void list_typeMainboard_filtersOutSme() {
        IpoListingEntity mainboard = entity("mb", "open", "mainboard", LocalDate.of(2026, 7, 20), null, null);
        IpoListingEntity sme = entity("sme", "open", "sme", LocalDate.of(2026, 7, 21), null, null);
        when(listingRepository.findAll()).thenReturn(List.of(mainboard, sme));
        when(pollService.lastSuccessAcrossSources()).thenReturn(Optional.empty());

        IpoListResponse response = service.list(null, "mainboard", null);

        assertThat(response.ipos()).extracting(IpoSummaryDto::id).containsExactly("mb");
    }

    @Test
    void list_typeIsCaseInsensitive() {
        IpoListingEntity sme = entity("sme", "open", "SME", LocalDate.of(2026, 7, 20), null, null);
        when(listingRepository.findAll()).thenReturn(List.of(sme));
        when(pollService.lastSuccessAcrossSources()).thenReturn(Optional.empty());

        IpoListResponse response = service.list(null, "sme", null);

        assertThat(response.ipos()).extracting(IpoSummaryDto::id).containsExactly("sme");
    }

    @Test
    void list_typeBlankOrAll_noFilterApplied() {
        IpoListingEntity mainboard = entity("mb", "open", "mainboard", LocalDate.of(2026, 7, 20), null, null);
        IpoListingEntity sme = entity("sme", "open", "sme", LocalDate.of(2026, 7, 21), null, null);
        when(listingRepository.findAll()).thenReturn(List.of(mainboard, sme));
        when(pollService.lastSuccessAcrossSources()).thenReturn(Optional.empty());

        assertThat(service.list(null, "", null).ipos()).hasSize(2);
        assertThat(service.list(null, "all", null).ipos()).hasSize(2);
        assertThat(service.list(null, "ALL", null).ipos()).hasSize(2);
    }

    @Test
    void list_sortGmp_ordersByGmpPctDescendingWithNullsLast() {
        IpoListingEntity high = entity("high", "open", "mainboard", null, new BigDecimal("40.00"), null);
        IpoListingEntity low = entity("low", "open", "mainboard", null, new BigDecimal("10.00"), null);
        IpoListingEntity noGmp = entity("no-gmp", "open", "mainboard", null, null, null);
        when(listingRepository.findAll()).thenReturn(List.of(low, noGmp, high));
        when(pollService.lastSuccessAcrossSources()).thenReturn(Optional.empty());

        IpoListResponse response = service.list(null, null, "gmp");

        assertThat(response.ipos()).extracting(IpoSummaryDto::id).containsExactly("high", "low", "no-gmp");
    }

    @Test
    void list_sortSubscription_ordersBySubTotalDescendingWithNullsLast() {
        IpoListingEntity high = entity("high", "open", "mainboard", null, null, new BigDecimal("50.00"));
        IpoListingEntity low = entity("low", "open", "mainboard", null, null, new BigDecimal("5.00"));
        IpoListingEntity noSub = entity("no-sub", "open", "mainboard", null, null, null);
        when(listingRepository.findAll()).thenReturn(List.of(low, noSub, high));
        when(pollService.lastSuccessAcrossSources()).thenReturn(Optional.empty());

        IpoListResponse response = service.list(null, null, "subscription");

        assertThat(response.ipos()).extracting(IpoSummaryDto::id).containsExactly("high", "low", "no-sub");
    }

    @Test
    void list_unrecognizedSort_fallsBackToDateOrder() {
        IpoListingEntity older = entity("older", "open", LocalDate.of(2026, 6, 1));
        IpoListingEntity newer = entity("newer", "open", LocalDate.of(2026, 7, 20));
        when(listingRepository.findAll()).thenReturn(List.of(older, newer));
        when(pollService.lastSuccessAcrossSources()).thenReturn(Optional.empty());

        IpoListResponse response = service.list(null, null, "bogus");

        assertThat(response.ipos()).extracting(IpoSummaryDto::id).containsExactly("newer", "older");
    }

    @Test
    void detail_present_returnsMappedDto() {
        IpoListingEntity entity = entity("1", "open", LocalDate.of(2026, 7, 20));
        when(listingRepository.findById("1")).thenReturn(Optional.of(entity));

        IpoDetailDto dto = service.detail("1");

        assertThat(dto.id()).isEqualTo("1");
        assertThat(dto.companyName()).isEqualTo("Company 1");
    }

    @Test
    void detail_missing_throwsNotFound() {
        when(listingRepository.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.detail("missing"))
                .isInstanceOf(DbWorldException.class)
                .satisfies(ex -> assertThat(((DbWorldException) ex).getHttpStatus())
                        .isEqualTo(org.springframework.http.HttpStatus.NOT_FOUND));
    }

    @Test
    void detail_allotmentDatePresentRefundAndDematNull_derivesBothAsAllotmentPlusOneDay() {
        IpoListingEntity entity = IpoListingEntity.builder()
                .id("1").matchKey("1-key").companyName("Company 1").status("closed")
                .allotmentDate(LocalDate.of(2026, 7, 28))
                .build();
        when(listingRepository.findById("1")).thenReturn(Optional.of(entity));

        IpoDetailDto dto = service.detail("1");

        assertThat(dto.refundDate()).isEqualTo(LocalDate.of(2026, 7, 29));
        assertThat(dto.dematDate()).isEqualTo(LocalDate.of(2026, 7, 29));
    }

    @Test
    void detail_allotmentDateNull_leavesRefundAndDematNull() {
        IpoListingEntity entity = entity("1", "upcoming", LocalDate.of(2026, 7, 20)); // no allotmentDate yet
        when(listingRepository.findById("1")).thenReturn(Optional.of(entity));

        IpoDetailDto dto = service.detail("1");

        assertThat(dto.refundDate()).isNull();
        assertThat(dto.dematDate()).isNull();
    }

    @Test
    void detail_refundDateAlreadyStored_isPreserved_dematStillDerived() {
        IpoListingEntity entity = IpoListingEntity.builder()
                .id("1").matchKey("1-key").companyName("Company 1").status("closed")
                .allotmentDate(LocalDate.of(2026, 7, 28))
                .refundDate(LocalDate.of(2026, 7, 30)) // source-reported, differs from the derived value
                .build();
        when(listingRepository.findById("1")).thenReturn(Optional.of(entity));

        IpoDetailDto dto = service.detail("1");

        assertThat(dto.refundDate()).isEqualTo(LocalDate.of(2026, 7, 30)); // preserved, not overwritten
        assertThat(dto.dematDate()).isEqualTo(LocalDate.of(2026, 7, 29)); // derived
    }

    @Test
    void detail_bothTimelineDatesAlreadyStored_derivationSkippedEntirely() {
        IpoListingEntity entity = IpoListingEntity.builder()
                .id("1").matchKey("1-key").companyName("Company 1").status("listed")
                .allotmentDate(LocalDate.of(2026, 7, 28))
                .refundDate(LocalDate.of(2026, 7, 30))
                .dematDate(LocalDate.of(2026, 7, 31))
                .build();
        when(listingRepository.findById("1")).thenReturn(Optional.of(entity));

        IpoDetailDto dto = service.detail("1");

        assertThat(dto.refundDate()).isEqualTo(LocalDate.of(2026, 7, 30));
        assertThat(dto.dematDate()).isEqualTo(LocalDate.of(2026, 7, 31));
    }

    @Test
    void financials_mapsInPeriodEndChronologicalOrder() {
        // Repo is stubbed to already return periodEnd-ascending order (that's the repository
        // method's job); the service/mapper must preserve that order and pass totalAssets through.
        IpoFinancialEntity fy23 = IpoFinancialEntity.builder()
                .ipoId("1").fiscalYear("FY23").revenue(new BigDecimal("400.00")).pat(new BigDecimal("30.00"))
                .totalAssets(new BigDecimal("900.00")).periodEnd(LocalDate.of(2023, 3, 31)).build();
        IpoFinancialEntity fy24 = IpoFinancialEntity.builder()
                .ipoId("1").fiscalYear("FY24").revenue(new BigDecimal("500.00")).pat(new BigDecimal("50.00"))
                .totalAssets(new BigDecimal("1200.00")).periodEnd(LocalDate.of(2024, 3, 31)).build();
        when(financialRepository.findByIpoIdOrderByPeriodEndAsc("1")).thenReturn(List.of(fy23, fy24));

        List<IpoFinancialDto> result = service.financials("1");

        assertThat(result).extracting(IpoFinancialDto::fiscalYear).containsExactly("FY23", "FY24");
        assertThat(result).extracting(IpoFinancialDto::totalAssets)
                .containsExactly(new BigDecimal("900.00"), new BigDecimal("1200.00"));
    }

    @Test
    void financials_delegatesToPeriodEndOrderedRepositoryMethod_notTheStringFiscalYearSort() {
        // Regression guard for the ordering bug: must call the periodEnd-ordered finder, never the
        // old fiscalYear-string-ordered one (e.g. "Feb 2026" sorts before "FY 2021-22" as a string).
        when(financialRepository.findByIpoIdOrderByPeriodEndAsc("1")).thenReturn(List.of());

        service.financials("1");

        verify(financialRepository).findByIpoIdOrderByPeriodEndAsc("1");
    }

    @Test
    void financials_empty_returnsEmptyListNotError() {
        when(financialRepository.findByIpoIdOrderByPeriodEndAsc("1")).thenReturn(List.of());

        assertThat(service.financials("1")).isEmpty();
    }

    @Test
    void gmpHistory_mapsInAscendingOrder() {
        IpoGmpHistoryEntity p1 = IpoGmpHistoryEntity.builder()
                .ipoId("1").capturedAt(Instant.parse("2026-07-01T00:00:00Z"))
                .gmp(new java.math.BigDecimal("10.00")).gmpPct(new java.math.BigDecimal("8.00")).build();
        IpoGmpHistoryEntity p2 = IpoGmpHistoryEntity.builder()
                .ipoId("1").capturedAt(Instant.parse("2026-07-02T00:00:00Z"))
                .gmp(new java.math.BigDecimal("20.00")).gmpPct(new java.math.BigDecimal("16.00")).build();
        when(gmpHistoryRepository.findByIpoIdOrderByCapturedAtAsc("1")).thenReturn(List.of(p1, p2));

        List<GmpPointDto> points = service.gmpHistory("1");

        assertThat(points).extracting(GmpPointDto::t)
                .containsExactly(Instant.parse("2026-07-01T00:00:00Z"), Instant.parse("2026-07-02T00:00:00Z"));
    }

    @Test
    void gmpHistory_empty_returnsEmptyListNotError() {
        when(gmpHistoryRepository.findByIpoIdOrderByCapturedAtAsc("1")).thenReturn(List.of());

        List<GmpPointDto> points = service.gmpHistory("1");

        assertThat(points).isEmpty();
    }

    @Test
    void subscriptionHistory_mapsInAscendingOrder() {
        IpoSubscriptionHistoryEntity p1 = IpoSubscriptionHistoryEntity.builder()
                .ipoId("1").capturedAt(Instant.parse("2026-07-01T00:00:00Z"))
                .qib(new java.math.BigDecimal("1.00")).nii(new java.math.BigDecimal("2.00"))
                .retail(new java.math.BigDecimal("3.00")).total(new java.math.BigDecimal("6.00")).build();
        when(subscriptionHistoryRepository.findByIpoIdOrderByCapturedAtAsc("1")).thenReturn(List.of(p1));

        List<SubscriptionPointDto> points = service.subscriptionHistory("1");

        assertThat(points).extracting(SubscriptionPointDto::total).containsExactly(new java.math.BigDecimal("6.00"));
    }

    @Test
    void subscriptionHistory_empty_returnsEmptyListNotError() {
        when(subscriptionHistoryRepository.findByIpoIdOrderByCapturedAtAsc("1")).thenReturn(List.of());

        List<SubscriptionPointDto> points = service.subscriptionHistory("1");

        assertThat(points).isEmpty();
    }
}
