package com.db.dbworld.app.cinema.mediarequest.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestDto;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestStatus;
import com.db.dbworld.app.cinema.mediarequest.service.MediaRequestService;
import com.db.dbworld.core.context.UserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cinema/admin/media-requests")
@RequiredArgsConstructor
public class AdminMediaRequestController {

    private final MediaRequestService service;
    private final UserContext userContext;

    /** GET /api/cinema/admin/media-requests?status=PENDING (optional filter). */
    @GetMapping
    public ApiResponse<List<MediaRequestDto>> list(
            @RequestParam(required = false) MediaRequestStatus status
    ) {
        return ApiResponse.success(service.listAll(status, userContext.userId()));
    }

    /**
     * GET /api/cinema/admin/media-requests/pending-count — cheap counter for the
     * sidebar/dashboard badge. Returns {@code { "count": N }}.
     */
    @GetMapping("/pending-count")
    public ApiResponse<Map<String, Long>> pendingCount() {
        return ApiResponse.success(Map.of("count", service.countByStatus(MediaRequestStatus.PENDING)));
    }

    /** POST /api/cinema/admin/media-requests/{id}/fulfill — mark fulfilled and notify voters. */
    @PostMapping("/{id}/fulfill")
    public ApiResponse<MediaRequestDto> fulfill(@PathVariable Long id) {
        return ApiResponse.success(
                service.fulfill(id, userContext.userId(), userContext.email())
        );
    }

    /**
     * POST /api/cinema/admin/media-requests/{id}/dismiss
     * — mark dismissed and notify voters. Body: {@code { "reason": "..." }} optional.
     */
    @PostMapping("/{id}/dismiss")
    public ApiResponse<MediaRequestDto> dismiss(
            @PathVariable Long id,
            @RequestBody(required = false) DismissRequest body
    ) {
        String reason = body != null ? body.reason() : null;
        return ApiResponse.success(
                service.dismiss(id, reason, userContext.userId(), userContext.email())
        );
    }

    /** Minimal request body for the dismiss endpoint. */
    public record DismissRequest(String reason) {}

    /** POST /api/cinema/admin/media-requests/{id}/reopen — undo fulfill/dismiss, voters preserved. */
    @PostMapping("/{id}/reopen")
    public ApiResponse<MediaRequestDto> reopen(@PathVariable Long id) {
        return ApiResponse.success(service.reopen(id));
    }
}
