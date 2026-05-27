package com.db.dbworld.app.cinema.mediarequest.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.mediarequest.dto.MediaRequestDto;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestStatus;
import com.db.dbworld.app.cinema.mediarequest.service.MediaRequestService;
import com.db.dbworld.core.context.UserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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

    /** POST /api/cinema/admin/media-requests/{id}/fulfill — mark fulfilled and notify voters. */
    @PostMapping("/{id}/fulfill")
    public ApiResponse<MediaRequestDto> fulfill(@PathVariable Long id) {
        return ApiResponse.success(
                service.fulfill(id, userContext.userId(), userContext.email())
        );
    }

    /** POST /api/cinema/admin/media-requests/{id}/dismiss — mark dismissed without notifying. */
    @PostMapping("/{id}/dismiss")
    public ApiResponse<MediaRequestDto> dismiss(@PathVariable Long id) {
        return ApiResponse.success(service.dismiss(id));
    }
}
