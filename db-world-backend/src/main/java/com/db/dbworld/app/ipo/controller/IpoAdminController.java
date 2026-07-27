package com.db.dbworld.app.ipo.controller;

import com.db.dbworld.app.ipo.dto.IpoChangeDto;
import com.db.dbworld.app.ipo.dto.SourceHealthDto;
import com.db.dbworld.app.ipo.service.IpoAdminService;
import com.db.dbworld.core.role.annotations.AdminAccess;
import com.db.dbworld.payloads.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin-only IPO tracker console: source-health visibility, the recent change feed, and a manual
 * re-poll. Cadence editing is not here — {@code ipo-poll}'s cron lives on the existing admin
 * Scheduler page like every other scheduled job.
 */
@RestController
@RequestMapping("/api/admin/ipo")
@RequiredArgsConstructor
@AdminAccess
public class IpoAdminController {

    private final IpoAdminService adminService;

    @GetMapping("/sources")
    public ApiResponse<List<SourceHealthDto>> sources() {
        return ApiResponse.success(adminService.sourceHealth());
    }

    @GetMapping("/changes")
    public ApiResponse<List<IpoChangeDto>> changes() {
        return ApiResponse.success(adminService.recentChanges());
    }

    @PostMapping("/repoll")
    public ApiResponse<Void> repoll() {
        adminService.repoll();
        return ApiResponse.success("Re-poll triggered");
    }
}
