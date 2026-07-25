package com.db.dbworld.app.ipo.controller;

import com.db.dbworld.app.ipo.dto.GmpPointDto;
import com.db.dbworld.app.ipo.dto.IpoDetailDto;
import com.db.dbworld.app.ipo.dto.IpoFinancialDto;
import com.db.dbworld.app.ipo.dto.IpoListResponse;
import com.db.dbworld.app.ipo.dto.IpoSummaryDto;
import com.db.dbworld.app.ipo.dto.SubscriptionPointDto;
import com.db.dbworld.app.ipo.service.IpoQueryService;
import com.db.dbworld.payloads.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IpoControllerTest {

    IpoQueryService queryService;
    IpoController controller;

    @BeforeEach
    void setUp() {
        queryService = mock(IpoQueryService.class);
        controller = new IpoController(queryService);
    }

    @Test
    void list_delegatesStatusTypeSortAndReturnsServiceResult() {
        IpoSummaryDto summary = new IpoSummaryDto("1", "Acme Corp", "mainboard", "open",
                LocalDate.of(2026, 7, 20), LocalDate.of(2026, 7, 24), null,
                new BigDecimal("100.00"), new BigDecimal("110.00"), new BigDecimal("20.00"),
                new BigDecimal("18.00"), new BigDecimal("1.50"), 130, null, null, "awaited", null, null);
        IpoListResponse expected = new IpoListResponse(List.of(summary), Instant.parse("2026-07-24T09:00:00Z"));
        when(queryService.list("open", "mainboard", "gmp")).thenReturn(expected);

        ApiResponse<IpoListResponse> response = controller.list("open", "mainboard", "gmp");

        verify(queryService).list("open", "mainboard", "gmp");
        assertThat(response.getData()).isSameAs(expected);
    }

    @Test
    void list_nullParams_passedThrough() {
        IpoListResponse expected = new IpoListResponse(List.of(), null);
        when(queryService.list(null, null, null)).thenReturn(expected);

        ApiResponse<IpoListResponse> response = controller.list(null, null, null);

        verify(queryService).list(null, null, null);
        assertThat(response.getData()).isSameAs(expected);
    }

    @Test
    void detail_delegatesIdAndReturnsServiceResult() {
        IpoDetailDto expected = new IpoDetailDto("1", "Acme Corp", "mainboard", "open",
                LocalDate.of(2026, 7, 20), LocalDate.of(2026, 7, 24), LocalDate.of(2026, 7, 28),
                LocalDate.of(2026, 7, 30), new BigDecimal("100.00"), new BigDecimal("110.00"),
                null, null, new BigDecimal("20.00"), new BigDecimal("18.00"), new BigDecimal("1.50"),
                130, "500 Cr", null, "awaited", "Link Intime", "https://registrar", null, null,
                LocalDate.of(2026, 7, 29), LocalDate.of(2026, 8, 1),
                null, null, null, null, List.of(), List.of());
        when(queryService.detail("1")).thenReturn(expected);

        ApiResponse<IpoDetailDto> response = controller.detail("1");

        verify(queryService).detail("1");
        assertThat(response.getData()).isSameAs(expected);
    }

    @Test
    void financials_delegatesIdAndReturnsServiceResult() {
        List<IpoFinancialDto> expected = List.of(new IpoFinancialDto("FY24", new BigDecimal("500.00"), new BigDecimal("50.00")));
        when(queryService.financials("1")).thenReturn(expected);

        ApiResponse<List<IpoFinancialDto>> response = controller.financials("1");

        verify(queryService).financials("1");
        assertThat(response.getData()).isSameAs(expected);
    }

    @Test
    void financials_empty_returnsEmptyListWrapped() {
        when(queryService.financials("1")).thenReturn(List.of());

        ApiResponse<List<IpoFinancialDto>> response = controller.financials("1");

        assertThat(response.getData()).isEmpty();
    }

    @Test
    void gmpHistory_delegatesIdAndReturnsServiceResult() {
        List<GmpPointDto> expected = List.of(new GmpPointDto(Instant.parse("2026-07-01T00:00:00Z"),
                new BigDecimal("10.00"), new BigDecimal("8.00")));
        when(queryService.gmpHistory("1")).thenReturn(expected);

        ApiResponse<List<GmpPointDto>> response = controller.gmpHistory("1");

        verify(queryService).gmpHistory("1");
        assertThat(response.getData()).isSameAs(expected);
    }

    @Test
    void gmpHistory_empty_returnsEmptyListWrapped() {
        when(queryService.gmpHistory("1")).thenReturn(List.of());

        ApiResponse<List<GmpPointDto>> response = controller.gmpHistory("1");

        assertThat(response.getData()).isEmpty();
    }

    @Test
    void subscriptionHistory_delegatesIdAndReturnsServiceResult() {
        List<SubscriptionPointDto> expected = List.of(new SubscriptionPointDto(
                Instant.parse("2026-07-01T00:00:00Z"), new BigDecimal("1.00"), new BigDecimal("2.00"),
                new BigDecimal("3.00"), new BigDecimal("6.00")));
        when(queryService.subscriptionHistory("1")).thenReturn(expected);

        ApiResponse<List<SubscriptionPointDto>> response = controller.subscriptionHistory("1");

        verify(queryService).subscriptionHistory("1");
        assertThat(response.getData()).isSameAs(expected);
    }

    @Test
    void subscriptionHistory_empty_returnsEmptyListWrapped() {
        when(queryService.subscriptionHistory("1")).thenReturn(List.of());

        ApiResponse<List<SubscriptionPointDto>> response = controller.subscriptionHistory("1");

        assertThat(response.getData()).isEmpty();
    }
}
