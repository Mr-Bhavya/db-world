package com.db.dbworld.app.admin.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.admin.scheduler.service.SchedulerAdminService;
import com.db.dbworld.app.cinema.tmdb.people.service.PersonSyncService;
import com.db.dbworld.core.role.annotations.AdminAccess;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Log4j2
@RestController
@RequestMapping("/api/admin/scheduler")
@RequiredArgsConstructor
public class SchedulerAdminController {

    private final SchedulerAdminService schedulerAdminService;
    private final PersonSyncService     personSyncService;

    @GetMapping("/jobs")
    @AdminAccess
    public ApiResponse<List<Map<String, Object>>> listJobs() {
        return ApiResponse.success(schedulerAdminService.listJobs(personSyncService.countUnsynced()));
    }

    @GetMapping("/history")
    @AdminAccess
    public ApiResponse<List<Map<String, Object>>> getHistory(
            @RequestParam(defaultValue = "50") int limit) {
        return ApiResponse.success(schedulerAdminService.getHistory(limit));
    }

    @PostMapping("/trigger/{jobName}")
    @AdminAccess
    public ApiResponse<Void> trigger(@PathVariable String jobName) {
        log.info("Admin manually triggered scheduler job: {}", jobName);
        boolean started = schedulerAdminService.triggerNow(jobName);
        if (!started) {
            return ApiResponse.error(HttpStatus.CONFLICT, "Job is already running or unknown: " + jobName);
        }
        return ApiResponse.success("Job triggered: " + jobName);
    }

    @PatchMapping("/toggle/{jobName}")
    @AdminAccess
    public ApiResponse<Void> toggle(@PathVariable String jobName) {
        log.info("Admin toggling scheduler job: {}", jobName);
        boolean nowEnabled = schedulerAdminService.toggle(jobName);
        return ApiResponse.success("Job " + jobName + (nowEnabled ? " enabled" : " disabled"));
    }

    @PatchMapping("/cron/{jobName}")
    @AdminAccess
    public ApiResponse<Void> updateCron(
            @PathVariable String jobName,
            @RequestBody Map<String, String> body) {
        String cron     = body.get("cronExpression");
        String timezone = body.get("timezone");
        if (cron == null || cron.isBlank()) {
            log.warn("updateCron rejected: missing cronExpression for job={}", jobName);
            return ApiResponse.error(HttpStatus.BAD_REQUEST, "cronExpression is required");
        }
        log.info("Admin updating cron for job={} to '{}' (tz={})", jobName, cron, timezone);
        schedulerAdminService.updateCron(jobName, cron, timezone);
        return ApiResponse.success("Cron updated for " + jobName);
    }

    @PatchMapping("/reorder")
    @AdminAccess
    public ApiResponse<Void> reorder(@RequestBody List<Map<String, Object>> orders) {
        log.info("Admin reordering scheduler jobs (count={})", orders != null ? orders.size() : 0);
        schedulerAdminService.reorder(orders);
        return ApiResponse.success("Order saved");
    }
}
