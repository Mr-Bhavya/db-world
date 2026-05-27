package com.db.dbworld.app.admin.analytics.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.admin.analytics.dto.AnalyticsOverviewDto;
import com.db.dbworld.app.admin.analytics.dto.ClientBreakdownDto;
import com.db.dbworld.app.admin.analytics.dto.DailyActivityDto;
import com.db.dbworld.app.admin.analytics.dto.TopRecordDto;
import com.db.dbworld.app.admin.analytics.dto.TopUserDto;
import com.db.dbworld.app.admin.analytics.service.AdminAnalyticsService;
import com.db.dbworld.core.role.annotations.AdminAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/analytics")
@RequiredArgsConstructor
public class AdminAnalyticsController {

    private final AdminAnalyticsService analyticsService;

    @GetMapping("/overview")
    @AdminAccess
    public ApiResponse<AnalyticsOverviewDto> getOverview() {
        return ApiResponse.success(analyticsService.getOverview());
    }

    @GetMapping("/trend")
    @AdminAccess
    public ApiResponse<List<DailyActivityDto>> getTrend(
            @RequestParam(defaultValue = "30") int days
    ) {
        return ApiResponse.success(analyticsService.getDailyTrend(days));
    }

    @GetMapping("/client-breakdown")
    @AdminAccess
    public ApiResponse<List<ClientBreakdownDto>> getClientBreakdown() {
        return ApiResponse.success(analyticsService.getClientBreakdown());
    }

    @GetMapping("/top-records")
    @AdminAccess
    public ApiResponse<List<TopRecordDto>> getTopRecords(
            @RequestParam(defaultValue = "20") int limit
    ) {
        return ApiResponse.success(analyticsService.getTopRecords(limit));
    }

    @GetMapping("/top-users")
    @AdminAccess
    public ApiResponse<List<TopUserDto>> getTopUsers(
            @RequestParam(defaultValue = "20") int limit
    ) {
        return ApiResponse.success(analyticsService.getTopUsers(limit));
    }
}
