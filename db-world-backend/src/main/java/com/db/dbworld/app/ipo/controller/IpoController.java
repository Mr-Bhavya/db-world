package com.db.dbworld.app.ipo.controller;

import com.db.dbworld.app.ipo.dto.GmpPointDto;
import com.db.dbworld.app.ipo.dto.IpoDetailDto;
import com.db.dbworld.app.ipo.dto.IpoListResponse;
import com.db.dbworld.app.ipo.dto.SubscriptionPointDto;
import com.db.dbworld.app.ipo.service.IpoQueryService;
import com.db.dbworld.core.role.annotations.AnyRole;
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
@RequestMapping("/api/ipo")
@RequiredArgsConstructor
@AnyRole
public class IpoController {

    private final IpoQueryService queryService;

    @GetMapping
    public ApiResponse<IpoListResponse> list(@RequestParam(required = false) String status) {
        return ApiResponse.success(queryService.list(status));
    }

    @GetMapping("/{id}")
    public ApiResponse<IpoDetailDto> detail(@PathVariable String id) {
        return ApiResponse.success(queryService.detail(id));
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
