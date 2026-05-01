package com.db.dbworld.app.cinema.interaction.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.interaction.dto.InteractionDto;
import com.db.dbworld.app.cinema.interaction.service.InteractionService;
import com.db.dbworld.app.cinema.rail.dto.RailPageDto;
import com.db.dbworld.app.cinema.rail.service.RailService;
import com.db.dbworld.core.context.UserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cinema/interactions")
@RequiredArgsConstructor
public class InteractionController {

    private final InteractionService interactionService;
    private final RailService railService;
    private final UserContext userContext;

    /* =========================
       WATCHLIST
       ========================= */

    @PostMapping("/watchlist")
    public ApiResponse<Void> addToWatchlist(@RequestParam Long recordId) {
        interactionService.addToWatchlist(userContext.userId(), recordId);
        return ApiResponse.success("Added to watchlist");
    }

    @DeleteMapping("/watchlist")
    public ApiResponse<Void> removeFromWatchlist(@RequestParam Long recordId) {
        interactionService.removeFromWatchlist(userContext.userId(), recordId);
        return ApiResponse.success("Removed from watchlist");
    }

    /* =========================
       LIKE
       ========================= */

    @PostMapping("/like")
    public ApiResponse<Void> like(@RequestParam Long recordId) {
        interactionService.like(userContext.userId(), recordId);
        return ApiResponse.success("Liked successfully");
    }

    @DeleteMapping("/like")
    public ApiResponse<Void> unlike(@RequestParam Long recordId) {
        interactionService.unlike(userContext.userId(), recordId);
        return ApiResponse.success("Unliked successfully");
    }

    /* =========================
       LOVE
       ========================= */

    @PostMapping("/love")
    public ApiResponse<Void> love(@RequestParam Long recordId) {
        interactionService.love(userContext.userId(), recordId);
        return ApiResponse.success("Loved successfully");
    }

    @DeleteMapping("/love")
    public ApiResponse<Void> unlove(@RequestParam Long recordId) {
        interactionService.unlove(userContext.userId(), recordId);
        return ApiResponse.success("Love removed");
    }

    /* =========================
       WATCHED
       ========================= */

    @PostMapping("/watched")
    public ApiResponse<Void> markWatched(@RequestParam Long recordId) {
        interactionService.markWatched(userContext.userId(), recordId);
        return ApiResponse.success("Marked as watched");
    }

    @DeleteMapping("/watched")
    public ApiResponse<Void> unmarkWatched(@RequestParam Long recordId) {
        interactionService.unmarkWatched(userContext.userId(), recordId);
        return ApiResponse.success("Removed from watched");
    }

    /* =========================
       PROGRESS
       ========================= */

    @PostMapping("/progress")
    public ApiResponse<Void> updateProgress(
            @RequestParam Long recordId,
            @RequestParam Integer progress
    ) {
        interactionService.updateProgress(userContext.userId(), recordId, progress);
        return ApiResponse.success("Progress updated");
    }

    /* =========================
       WATCHLIST RECORDS
       ========================= */

    @GetMapping("/watchlist/records")
    public ApiResponse<RailPageDto> getWatchlistRecords(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        return ApiResponse.success(
                railService.getWatchlistRecords(userContext.userId(), page, size)
        );
    }

    /* =========================
       GET
       ========================= */

    @GetMapping
    public ApiResponse<InteractionDto> getInteraction(@RequestParam Long recordId) {
        return ApiResponse.success(
                interactionService.getInteraction(userContext.userId(), recordId)
        );
    }

    @PostMapping("/batch")
    public ApiResponse<List<InteractionDto>> getInteractions(@RequestBody List<Long> recordIds) {
        return ApiResponse.success(
                interactionService.getInteractions(userContext.userId(), recordIds)
        );
    }
}