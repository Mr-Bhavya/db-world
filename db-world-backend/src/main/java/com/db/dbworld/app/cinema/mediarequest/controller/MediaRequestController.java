package com.db.dbworld.app.cinema.mediarequest.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestScopeSummary;
import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestVoteResponse;
import com.db.dbworld.app.cinema.mediarequest.dto.MyMediaRequestEntry;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestKind;
import com.db.dbworld.app.cinema.mediarequest.service.MediaRequestService;
import com.db.dbworld.core.context.UserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cinema/media-requests")
@RequiredArgsConstructor
public class MediaRequestController {

    private final MediaRequestService service;
    private final UserContext userContext;

    /**
     * POST /api/cinema/media-requests/{recordId}/vote?kind=NEW_FILES&amp;season=2&amp;episode=5
     * — toggle the caller's vote for a request of the given kind and scope on this record.
     *
     * <p>Default kind is NEW_FILES so the empty-state flow doesn't need to pass it. Omitting
     * {@code season} asks for the whole title (the only shape a movie has); {@code season}
     * alone asks for that season; both narrow it to one episode.
     */
    @PostMapping("/{recordId}/vote")
    public ApiResponse<MediaRequestVoteResponse> toggleVote(
            @PathVariable Long recordId,
            @RequestParam(defaultValue = "NEW_FILES") MediaRequestKind kind,
            @RequestParam(required = false) Integer season,
            @RequestParam(required = false) Integer episode
    ) {
        return ApiResponse.success(service.toggleVote(recordId, userContext.userId(), kind, season, episode));
    }

    /** GET /api/cinema/media-requests/mine — {recordId, kind, season, episode} entries the caller voted for. */
    @GetMapping("/mine")
    public ApiResponse<List<MyMediaRequestEntry>> getMine() {
        return ApiResponse.success(service.getMyPendingRequests(userContext.userId()));
    }

    /**
     * GET /api/cinema/media-requests/record/{recordId} — every pending request on one record with
     * its vote count, so the detail page can render "3 want this" per season/episode in one call.
     */
    @GetMapping("/record/{recordId}")
    public ApiResponse<List<MediaRequestScopeSummary>> getForRecord(@PathVariable Long recordId) {
        return ApiResponse.success(service.listPendingForRecord(recordId, userContext.userId()));
    }
}
