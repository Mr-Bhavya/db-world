package com.db.dbworld.app.cinema.catalogrequest.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.catalogrequest.dto.CatalogIngestRequestSubmission;
import com.db.dbworld.app.cinema.catalogrequest.dto.CatalogIngestRequestVoteResponse;
import com.db.dbworld.app.cinema.catalogrequest.dto.MyCatalogIngestRequestEntry;
import com.db.dbworld.app.cinema.catalogrequest.service.CatalogIngestRequestService;
import com.db.dbworld.core.context.UserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cinema/catalog-requests")
@RequiredArgsConstructor
public class CatalogIngestRequestController {

    private final CatalogIngestRequestService service;
    private final UserContext userContext;

    /**
     * POST /api/cinema/catalog-requests/vote
     * Body: {@code { tmdbId, mediaType: "MOVIE"|"TV_SERIES", title, posterPath, releaseYear, note }}.
     * Idempotently toggles the caller's vote on the corresponding catalog ingest request.
     */
    @PostMapping("/vote")
    public ApiResponse<CatalogIngestRequestVoteResponse> toggleVote(
            @RequestBody CatalogIngestRequestSubmission body
    ) {
        return ApiResponse.success(service.toggleVote(body, userContext.userId()));
    }

    /** GET /api/cinema/catalog-requests/mine — {tmdbId, mediaType} pairs the caller has voted for. */
    @GetMapping("/mine")
    public ApiResponse<List<MyCatalogIngestRequestEntry>> getMine() {
        return ApiResponse.success(service.getMyPendingRequests(userContext.userId()));
    }
}
