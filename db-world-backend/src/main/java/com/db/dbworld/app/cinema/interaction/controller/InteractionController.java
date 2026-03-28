package com.db.dbworld.app.cinema.interaction.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.cinema.interaction.dto.InteractionDto;
import com.db.dbworld.cinema.interaction.service.InteractionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cinema/interactions")
@RequiredArgsConstructor
public class InteractionController {

    private final InteractionService interactionService;

    /* =========================
       WATCHLIST
       ========================= */

    @PostMapping("/watchlist")
    public ApiResponse<Void> addToWatchlist(
            @RequestParam Long userId,
            @RequestParam Long recordId
    ) {

        interactionService.addToWatchlist(userId, recordId);

        return ApiResponse.success("Added to watchlist");
    }

    @DeleteMapping("/watchlist")
    public ApiResponse<Void> removeFromWatchlist(
            @RequestParam Long userId,
            @RequestParam Long recordId
    ) {

        interactionService.removeFromWatchlist(userId, recordId);

        return ApiResponse.success("Removed from watchlist");
    }

    /* =========================
       LIKE
       ========================= */

    @PostMapping("/like")
    public ApiResponse<Void> like(
            @RequestParam Long userId,
            @RequestParam Long recordId
    ) {

        interactionService.like(userId, recordId);

        return ApiResponse.success("Liked successfully");
    }

    @DeleteMapping("/like")
    public ApiResponse<Void> unlike(
            @RequestParam Long userId,
            @RequestParam Long recordId
    ) {

        interactionService.unlike(userId, recordId);

        return ApiResponse.success("Unliked successfully");
    }

    /* =========================
       LOVE
       ========================= */

    @PostMapping("/love")
    public ApiResponse<Void> love(
            @RequestParam Long userId,
            @RequestParam Long recordId
    ) {

        interactionService.love(userId, recordId);

        return ApiResponse.success("Loved successfully");
    }

    @DeleteMapping("/love")
    public ApiResponse<Void> unlove(
            @RequestParam Long userId,
            @RequestParam Long recordId
    ) {

        interactionService.unlove(userId, recordId);

        return ApiResponse.success("Love removed");
    }

    /* =========================
       WATCHED
       ========================= */

    @PostMapping("/watched")
    public ApiResponse<Void> markWatched(
            @RequestParam Long userId,
            @RequestParam Long recordId
    ) {

        interactionService.markWatched(userId, recordId);

        return ApiResponse.success("Marked as watched");
    }

    @DeleteMapping("/watched")
    public ApiResponse<Void> unmarkWatched(
            @RequestParam Long userId,
            @RequestParam Long recordId
    ) {

        interactionService.unmarkWatched(userId, recordId);

        return ApiResponse.success("Removed from watched");
    }

    /* =========================
       PROGRESS
       ========================= */

    @PostMapping("/progress")
    public ApiResponse<Void> updateProgress(
            @RequestParam Long userId,
            @RequestParam Long recordId,
            @RequestParam Integer progress
    ) {

        interactionService.updateProgress(userId, recordId, progress);

        return ApiResponse.success("Progress updated");
    }

    /* =========================
       GET
       ========================= */

    @GetMapping
    public ApiResponse<InteractionDto> getInteraction(
            @RequestParam Long userId,
            @RequestParam Long recordId
    ) {

        return ApiResponse.success(
                interactionService.getInteraction(userId, recordId)
        );
    }

    @PostMapping("/batch")
    public ApiResponse<List<InteractionDto>> getInteractions(
            @RequestParam Long userId,
            @RequestBody List<Long> recordIds
    ) {

        return ApiResponse.success(
                interactionService.getInteractions(userId, recordIds)
        );
    }
}