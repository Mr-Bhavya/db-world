package com.db.dbworld.app.cinema.mediarequest.controller;

import com.db.dbworld.api.response.ApiResponse;
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
     * POST /api/cinema/media-requests/{recordId}/vote?kind=NEW_FILES
     * — toggle caller's vote for a request of the given kind on this record.
     * Default kind is NEW_FILES so the empty-state flow doesn't need to pass it.
     */
    @PostMapping("/{recordId}/vote")
    public ApiResponse<MediaRequestVoteResponse> toggleVote(
            @PathVariable Long recordId,
            @RequestParam(defaultValue = "NEW_FILES") MediaRequestKind kind
    ) {
        return ApiResponse.success(service.toggleVote(recordId, userContext.userId(), kind));
    }

    /** GET /api/cinema/media-requests/mine — {recordId, kind} entries the caller voted for. */
    @GetMapping("/mine")
    public ApiResponse<List<MyMediaRequestEntry>> getMine() {
        return ApiResponse.success(service.getMyPendingRequests(userContext.userId()));
    }
}
