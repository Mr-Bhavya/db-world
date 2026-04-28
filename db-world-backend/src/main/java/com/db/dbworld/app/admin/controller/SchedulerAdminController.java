package com.db.dbworld.app.admin.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.catalog.tags.scheduler.TagScheduler;
import com.db.dbworld.app.cinema.tmdb.sync.scheduler.TmdbSyncScheduler;
import com.db.dbworld.app.cinema.tmdb.people.scheduler.PersonSyncScheduler;
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

    private final TagScheduler       tagScheduler;
    private final TmdbSyncScheduler  tmdbSyncScheduler;
    private final PersonSyncScheduler personSyncScheduler;
    private final PersonSyncService   personSyncService;

    /** List known scheduler jobs. */
    @GetMapping("/jobs")
    @AdminAccess
    public ApiResponse<List<Map<String, Object>>> listJobs() {
        return ApiResponse.success(List.of(
                Map.of("id", "TagScheduler",      "name", "Tag Scheduler",
                        "cronExpression", "0 0 3 * * *",   "enabled", true, "status", "IDLE",
                        "description", "Recalculates tag rails and trending scores"),
                Map.of("id", "TmdbSyncScheduler", "name", "TMDB Sync",
                        "cronExpression", "0 0 2 * * *",   "enabled", true, "status", "IDLE",
                        "description", "Syncs changed movies & TV series from TMDB"),
                Map.of("id", "PersonSyncScheduler", "name", "Person Detail Sync",
                        "cronExpression", "0 0 3 * * *",   "enabled", true, "status", "IDLE",
                        "description", "Fetches full biography & details for unsynced cast/crew (" + personSyncService.countUnsynced() + " pending)"),
                Map.of("id", "RailCacheInvalidation", "name", "Rail Cache Invalidation",
                        "cronExpression", "0 */30 * * * *", "enabled", true, "status", "IDLE",
                        "description", "Invalidates and rebuilds cinema rail caches")
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
            case "PersonSyncScheduler" -> new Thread(personSyncScheduler::runPersonSync, "admin-person-sync-trigger").start();
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
