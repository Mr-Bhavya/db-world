package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.GmpPointDto;
import com.db.dbworld.app.ipo.dto.IpoDetailDto;
import com.db.dbworld.app.ipo.dto.IpoListResponse;
import com.db.dbworld.app.ipo.dto.IpoSummaryDto;
import com.db.dbworld.app.ipo.dto.SubscriptionPointDto;
import com.db.dbworld.app.ipo.entity.IpoGmpHistoryEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.entity.IpoSubscriptionHistoryEntity;
import com.db.dbworld.app.ipo.mapper.IpoMapper;
import com.db.dbworld.app.ipo.repository.IpoGmpHistoryRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.repository.IpoSubscriptionHistoryRepository;
import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

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
    IpoSourcePollService pollService;
    IpoQueryService service;

    @BeforeEach
    void setUp() {
        listingRepository = mock(IpoListingRepository.class);
        gmpHistoryRepository = mock(IpoGmpHistoryRepository.class);
        subscriptionHistoryRepository = mock(IpoSubscriptionHistoryRepository.class);
        pollService = mock(IpoSourcePollService.class);
        service = new IpoQueryService(listingRepository, gmpHistoryRepository, subscriptionHistoryRepository,
                pollService, new IpoMapper());
    }

    private IpoListingEntity entity(String id, String status, LocalDate openDate) {
        return IpoListingEntity.builder()
                .id(id)
                .matchKey(id + "-key")
                .companyName("Company " + id)
                .ipoType("mainboard")
                .status(status)
                .openDate(openDate)
                .build();
    }

    @Test
    void list_blankStatus_usesFindAll() {
        when(listingRepository.findAll()).thenReturn(List.of(entity("1", "open", LocalDate.of(2026, 7, 20))));
        when(pollService.lastSuccessAcrossSources()).thenReturn(Optional.of(LAST_SUCCESS));

        IpoListResponse response = service.list(null);

        verify(listingRepository).findAll();
        verify(listingRepository, never()).findByStatus(any());
        assertThat(response.ipos()).extracting(IpoSummaryDto::id).containsExactly("1");
        assertThat(response.lastUpdated()).isEqualTo(LAST_SUCCESS);
    }

    @Test
    void list_blankStringStatus_usesFindAll() {
        when(listingRepository.findAll()).thenReturn(List.of());
        when(pollService.lastSuccessAcrossSources()).thenReturn(Optional.empty());

        service.list("   ");

        verify(listingRepository).findAll();
        verify(listingRepository, never()).findByStatus(any());
    }

    @Test
    void list_withStatus_delegatesToFindByStatus() {
        when(listingRepository.findByStatus("open")).thenReturn(List.of(entity("1", "open", LocalDate.of(2026, 7, 20))));
        when(pollService.lastSuccessAcrossSources()).thenReturn(Optional.of(LAST_SUCCESS));

        IpoListResponse response = service.list("open");

        verify(listingRepository).findByStatus("open");
        verify(listingRepository, never()).findAll();
        assertThat(response.ipos()).hasSize(1);
        assertThat(response.lastUpdated()).isEqualTo(LAST_SUCCESS);
    }

    @Test
    void list_noSuccessfulPollEver_lastUpdatedIsNull() {
        when(listingRepository.findAll()).thenReturn(List.of());
        when(pollService.lastSuccessAcrossSources()).thenReturn(Optional.empty());

        IpoListResponse response = service.list(null);

        assertThat(response.lastUpdated()).isNull();
    }

    @Test
    void list_sortsByOpenDateDescendingWithNullsLast() {
        IpoListingEntity older = entity("older", "open", LocalDate.of(2026, 6, 1));
        IpoListingEntity newer = entity("newer", "open", LocalDate.of(2026, 7, 20));
        IpoListingEntity noOpenDate = entity("no-date", "upcoming", null);
        when(listingRepository.findAll()).thenReturn(List.of(older, noOpenDate, newer));
        when(pollService.lastSuccessAcrossSources()).thenReturn(Optional.empty());

        IpoListResponse response = service.list(null);

        assertThat(response.ipos()).extracting(IpoSummaryDto::id)
                .containsExactly("newer", "older", "no-date");
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
