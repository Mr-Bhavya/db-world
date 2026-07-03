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
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(required = false) String jobName) {
        List<Map<String, Object>> rows = (jobName == null || jobName.isBlank())
                ? schedulerAdminService.getHistory(limit)
                : schedulerAdminService.getHistoryForJob(jobName, limit);
        return ApiResponse.success(rows);
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

    /**
     * Update the interval of a FIXED_DELAY job (e.g. MediaSync). The new
     * value is read from the DB on the next scheduling decision — no app
     * restart needed.
     */
    @PatchMapping("/interval/{jobName}")
    @AdminAccess
    public ApiResponse<Void> updateInterval(
            @PathVariable String jobName,
            @RequestBody Map<String, Object> body) {
        Object raw = body.get("intervalSeconds");
        if (!(raw instanceof Number n) || n.intValue() <= 0) {
            log.warn("updateInterval rejected: missing/invalid intervalSeconds for job={}", jobName);
            return ApiResponse.error(HttpStatus.BAD_REQUEST,
                    "intervalSeconds (positive integer) is required");
        }
        log.info("Admin updating interval for job={} to {}s", jobName, n.intValue());
        schedulerAdminService.updateInterval(jobName, n.intValue());
        return ApiResponse.success("Interval updated for " + jobName);
    }

    /**
     * Consolidated partial-update endpoint. Accepts any combination of
     * {@code displayName} (string, "" to clear override),
     * {@code notes} (string, "" to clear),
     * {@code stabilityWindowSeconds} (non-negative int), and
     * {@code recheckIntervalHours} (positive int, TMDB sync jobs).
     * Cron and interval each have their own dedicated endpoint above —
     * they trigger re-scheduling and deserve separate paths.
     */
    @PatchMapping("/jobs/{jobName}")
    @AdminAccess
    public ApiResponse<Void> updateSettings(
            @PathVariable String jobName,
            @RequestBody Map<String, Object> body) {
        String displayName = body.containsKey("displayName") ? String.valueOf(body.get("displayName")) : null;
        String notes       = body.containsKey("notes")       ? String.valueOf(body.get("notes"))       : null;
        Integer stability  = null;
        if (body.get("stabilityWindowSeconds") instanceof Number n) {
            stability = n.intValue();
        } else if (body.containsKey("stabilityWindowSeconds") && body.get("stabilityWindowSeconds") != null) {
            return ApiResponse.error(HttpStatus.BAD_REQUEST,
                    "stabilityWindowSeconds must be a non-negative integer");
        }
        Integer recheckHours = null;
        if (body.get("recheckIntervalHours") instanceof Number n) {
            recheckHours = n.intValue();
        } else if (body.containsKey("recheckIntervalHours") && body.get("recheckIntervalHours") != null) {
            return ApiResponse.error(HttpStatus.BAD_REQUEST,
                    "recheckIntervalHours must be a positive integer");
        }
        log.info("Admin updating job={} settings (displayName={}, notes={}chars, stability={}, recheckHours={})",
                jobName, displayName, notes != null ? notes.length() : 0, stability, recheckHours);
        schedulerAdminService.updateSettings(jobName, displayName, notes, stability, recheckHours);
        return ApiResponse.success("Settings updated for " + jobName);
    }

    @PatchMapping("/reorder")
    @AdminAccess
    public ApiResponse<Void> reorder(@RequestBody List<Map<String, Object>> orders) {
        log.info("Admin reordering scheduler jobs (count={})", orders != null ? orders.size() : 0);
        schedulerAdminService.reorder(orders);
        return ApiResponse.success("Order saved");
    }
}
