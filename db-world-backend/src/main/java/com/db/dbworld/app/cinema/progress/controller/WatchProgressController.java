package com.db.dbworld.app.cinema.progress.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.progress.dto.ContinueWatchingDto;
import com.db.dbworld.app.cinema.progress.service.WatchProgressService;
import com.db.dbworld.core.context.UserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cinema/progress")
@RequiredArgsConstructor
public class WatchProgressController {

    private final WatchProgressService service;
    private final UserContext userContext;

    @PutMapping("/{fileId}")
    public ApiResponse<Void> save(
            @PathVariable String fileId,
            @RequestParam(required = false) Long recordId,
            @RequestParam long positionMs,
            @RequestParam(required = false, defaultValue = "0") long durationMs,
            @RequestParam(required = false) String audioLang,
            @RequestParam(required = false) String subLang) {
        service.saveProgress(userContext.userId(), fileId, recordId,
                positionMs, durationMs, audioLang, subLang);
        return ApiResponse.success("Progress saved");
    }

    @GetMapping("/{fileId}")
    public ApiResponse<WatchProgressService.ProgressDto> get(@PathVariable String fileId) {
        return ApiResponse.success(
                service.getProgress(userContext.userId(), fileId).orElse(null));
    }

    @GetMapping
    public ApiResponse<List<WatchProgressService.ProgressDto>> getRecent(
            @RequestParam(defaultValue = "30") int days) {
        return ApiResponse.success(
                service.getRecentProgress(userContext.userId(), days));
    }

    /** Continue Watching tiles: resume target + progress, completed items already filtered out. */
    @GetMapping("/continue")
    public ApiResponse<List<ContinueWatchingDto>> continueWatching() {
        return ApiResponse.success(service.getContinueWatching(userContext.userId()));
    }

    /** Remove a whole record from Continue Watching. */
    @DeleteMapping("/record/{recordId}")
    public ApiResponse<Void> removeRecord(@PathVariable Long recordId) {
        service.removeRecord(userContext.userId(), recordId);
        return ApiResponse.success("Removed from Continue Watching");
    }

    /** Remove a single file's saved progress. */
    @DeleteMapping("/{fileId}")
    public ApiResponse<Void> removeFile(@PathVariable String fileId) {
        service.removeFile(userContext.userId(), fileId);
        return ApiResponse.success("Progress removed");
    }
}
