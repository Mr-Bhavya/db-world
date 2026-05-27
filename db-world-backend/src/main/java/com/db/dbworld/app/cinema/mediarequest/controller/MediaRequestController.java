package com.db.dbworld.app.cinema.mediarequest.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestVoteResponse;
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

    /** POST /api/cinema/media-requests/{recordId}/vote — toggle caller's vote. */
    @PostMapping("/{recordId}/vote")
    public ApiResponse<MediaRequestVoteResponse> toggleVote(@PathVariable Long recordId) {
        return ApiResponse.success(service.toggleVote(recordId, userContext.userId()));
    }

    /** GET /api/cinema/media-requests/mine — record IDs the caller has voted for. */
    @GetMapping("/mine")
    public ApiResponse<List<Long>> getMine() {
        return ApiResponse.success(service.getMyPendingRecordIds(userContext.userId()));
    }
}
