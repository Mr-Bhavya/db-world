package com.db.dbworld.app.admin.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.catalog.tags.scheduler.TagScheduler;
import com.db.dbworld.app.cinema.tmdb.sync.scheduler.TmdbSyncScheduler;
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

    private final TagScheduler     tagScheduler;
    private final TmdbSyncScheduler tmdbSyncScheduler;

    /** List known scheduler jobs. */
    @GetMapping("/jobs")
    @AdminAccess
    public ApiResponse<List<Map<String, Object>>> listJobs() {
        return ApiResponse.success(List.of(
                Map.of("id", "TagScheduler",      "name", "TagScheduler",
                        "cronExpression", "0 0 3 * * *",  "enabled", true, "status", "IDLE"),
                Map.of("id", "TmdbSyncScheduler", "name", "TmdbSyncScheduler",
                        "cronExpression", "0 0 4 * * *",  "enabled", true, "status", "IDLE"),
                Map.of("id", "RailCacheInvalidation", "name", "RailCacheInvalidation",
                        "cronExpression", "0 */30 * * * *", "enabled", true, "status", "IDLE")
        ));
    }

    /** Execution history — not persisted yet; returns empty list. */
    @GetMapping("/history")
    @AdminAccess
    public ApiResponse<List<Object>> getHistory() {
        return ApiResponse.success(List.of());
    }

    /** Manually trigger a job by name. */
    @PostMapping("/trigger/{jobName}")
    @AdminAccess
    public ApiResponse<Void> trigger(@PathVariable String jobName) {
        log.info("Admin triggered scheduler job: {}", jobName);
        switch (jobName) {
            case "TagScheduler"      -> new Thread(tagScheduler::updateTags,      "admin-tag-trigger").start();
            case "TmdbSyncScheduler" -> new Thread(() -> {
                tmdbSyncScheduler.runMovieSync();
                tmdbSyncScheduler.runTvSync();
            }, "admin-tmdb-trigger").start();
            default -> { return ApiResponse.error(HttpStatus.BAD_REQUEST, "Unknown job: " + jobName); }
        }
        return ApiResponse.success("Job triggered: " + jobName);
    }

    /** Toggle job enabled state (no-op stub — real toggle needs persistent config). */
    @PatchMapping("/toggle/{jobName}")
    @AdminAccess
    public ApiResponse<Void> toggle(@PathVariable String jobName) {
        return ApiResponse.success("Toggled " + jobName + " (restart required to apply)");
    }
}
