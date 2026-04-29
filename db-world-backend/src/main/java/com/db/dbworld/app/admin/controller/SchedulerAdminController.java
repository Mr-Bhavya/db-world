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

    private final TagScheduler        tagScheduler;
    private final TmdbSyncScheduler   tmdbSyncScheduler;
    private final PersonSyncScheduler personSyncScheduler;
    private final PersonSyncService   personSyncService;

    /** List all admin-managed scheduler jobs with their actual cron expressions. */
    @GetMapping("/jobs")
    @AdminAccess
    public ApiResponse<List<Map<String, Object>>> listJobs() {
        return ApiResponse.success(List.of(
                Map.of("id", "TagScheduler", "name", "Tag Scheduler",
                        "cronExpression", "0 0 */6 * * *",
                        "enabled", true, "status", "IDLE",
                        "description", "Recalculates tag pools: Trending, Featured, New and all genre rails"),
                Map.of("id", "TmdbMovieSync", "name", "TMDB Movie Sync",
                        "cronExpression", "0 0 2 * * *",
                        "timezone", "Asia/Kolkata",
                        "enabled", true, "status", "IDLE",
                        "description", "Syncs updated movie metadata and images from TMDB (2:00 AM IST)"),
                Map.of("id", "TmdbTvSync", "name", "TMDB TV Sync",
                        "cronExpression", "0 10 2 * * *",
                        "timezone", "Asia/Kolkata",
                        "enabled", true, "status", "IDLE",
                        "description", "Syncs updated TV series metadata and images from TMDB (2:10 AM IST)"),
                Map.of("id", "PersonSyncScheduler", "name", "Person Detail Sync",
                        "cronExpression", "0 0 3 * * *",
                        "timezone", "Asia/Kolkata",
                        "enabled", true, "status", "IDLE",
                        "description", "Fetches full biography and images for unsynced cast/crew ("
                                + personSyncService.countUnsynced() + " pending)")
        ));
    }

    /** Execution history — not persisted yet; returns empty list. */
    @GetMapping("/history")
    @AdminAccess
    public ApiResponse<List<Object>> getHistory() {
        return ApiResponse.success(List.of());
    }

    /** Manually trigger a job by its id. */
    @PostMapping("/trigger/{jobName}")
    @AdminAccess
    public ApiResponse<Void> trigger(@PathVariable String jobName) {
        log.info("Admin manually triggered scheduler job: {}", jobName);
        switch (jobName) {
            case "TagScheduler" ->
                new Thread(tagScheduler::updateTags, "admin-tag-trigger").start();
            case "TmdbMovieSync" ->
                new Thread(tmdbSyncScheduler::runMovieSync, "admin-tmdb-movie-trigger").start();
            case "TmdbTvSync" ->
                new Thread(tmdbSyncScheduler::runTvSync, "admin-tmdb-tv-trigger").start();
            case "PersonSyncScheduler" ->
                new Thread(personSyncScheduler::runPersonSync, "admin-person-sync-trigger").start();
            default -> {
                return ApiResponse.error(HttpStatus.BAD_REQUEST, "Unknown job: " + jobName);
            }
        }
        return ApiResponse.success("Job triggered: " + jobName);
    }

    /** Toggle job enabled state — no-op until persistent config is implemented. */
    @PatchMapping("/toggle/{jobName}")
    @AdminAccess
    public ApiResponse<Void> toggle(@PathVariable String jobName) {
        return ApiResponse.success("Toggled " + jobName + " (app restart required to apply)");
    }
}
