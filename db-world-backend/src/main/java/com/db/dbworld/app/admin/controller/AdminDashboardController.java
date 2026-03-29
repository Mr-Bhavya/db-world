package com.db.dbworld.app.admin.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.admin.dto.AdminDashboardDto;
import com.db.dbworld.app.admin.service.AdminDashboardService;
import com.db.dbworld.core.role.annotations.AdminAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/dashboard")
@RequiredArgsConstructor
public class AdminDashboardController {

    private final AdminDashboardService dashboardService;

    /** Aggregate stats for the admin overview dashboard. */
    @GetMapping("/stats")
    @AdminAccess
    public ApiResponse<AdminDashboardDto> getStats() {
        return ApiResponse.success(dashboardService.getStats());
    }
}
