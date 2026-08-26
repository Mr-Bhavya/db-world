package com.db.dbworld.app.ipo.controller;

import com.db.dbworld.app.ipo.dto.GmpPointDto;
import com.db.dbworld.app.ipo.dto.IpoDetailDto;
import com.db.dbworld.app.ipo.dto.IpoFinancialDto;
import com.db.dbworld.app.ipo.dto.IpoListResponse;
import com.db.dbworld.app.ipo.dto.SubscriptionPointDto;
import com.db.dbworld.app.ipo.service.IpoQueryService;
import com.db.dbworld.payloads.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * User-facing IPO tracker reads: the list view, a single IPO's detail, and the GMP /
 * subscription history series that feed the frontend's charts. Thin — everything delegates to
 * {@link IpoQueryService}.
 */
@RestController
/**
 * Public read surface for the IPO tracker.
 *
 * <p>The class-level {@code @AnyRole} was removed so anonymous visitors can browse.
 * Listing the paths in {@code PUBLIC_GET_APIS} alone is not enough: method security
 * runs after the filter chain has already allowed the request, and would still deny it
 * — as a 500, not a 401.
 *
 * <p>{@code IpoApplicationController} shares this base path and KEEPS its
 * {@code @AnyRole}, because everything there is scoped to a signed-in user's own
 * applications. That is why the rules in {@code AppConstants.PUBLIC_GET_APIS} are
 * GET-scoped and single-segment.
 */
@RequestMapping("/api/ipo")
@RequiredArgsConstructor
public class IpoController {

    private final IpoQueryService queryService;

    @GetMapping
    public ApiResponse<IpoListResponse> list(@RequestParam(required = false) String status,
                                              @RequestParam(required = false) String type,
                                              @RequestParam(required = false) String sort) {
        return ApiResponse.success(queryService.list(status, type, sort));
    }

    @GetMapping("/{id}")
    public ApiResponse<IpoDetailDto> detail(@PathVariable String id) {
        return ApiResponse.success(queryService.detail(id));
    }

    @GetMapping("/{id}/financials")
    public ApiResponse<List<IpoFinancialDto>> financials(@PathVariable String id) {
        return ApiResponse.success(queryService.financials(id));
    }

    @GetMapping("/{id}/gmp-history")
    public ApiResponse<List<GmpPointDto>> gmpHistory(@PathVariable String id) {
        return ApiResponse.success(queryService.gmpHistory(id));
    }

    @GetMapping("/{id}/subscription-history")
    public ApiResponse<List<SubscriptionPointDto>> subscriptionHistory(@PathVariable String id) {
        return ApiResponse.success(queryService.subscriptionHistory(id));
    }
}
