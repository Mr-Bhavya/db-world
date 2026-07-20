package com.db.dbworld.app.cinema.catalogrequest.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.catalogrequest.dto.CatalogIngestRequestDto;
import com.db.dbworld.app.cinema.catalogrequest.entity.CatalogIngestRequestStatus;
import com.db.dbworld.app.cinema.catalogrequest.service.CatalogIngestRequestService;
import com.db.dbworld.core.context.UserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cinema/admin/catalog-requests")
@RequiredArgsConstructor
public class AdminCatalogIngestRequestController {

    private final CatalogIngestRequestService service;
    private final UserContext userContext;

    @GetMapping
    public ApiResponse<List<CatalogIngestRequestDto>> list(
            @RequestParam(required = false) CatalogIngestRequestStatus status
    ) {
        return ApiResponse.success(service.listAll(status, userContext.userId()));
    }

    /**
     * GET /api/cinema/admin/catalog-requests/pending-count — cheap counter for the
     * sidebar/dashboard badge. Returns {@code { "count": N }}.
     */
    @GetMapping("/pending-count")
    public ApiResponse<Map<String, Long>> pendingCount() {
        return ApiResponse.success(Map.of("count", service.countByStatus(CatalogIngestRequestStatus.PENDING)));
    }

    /** Ingest the TMDB title and notify voters with a deep link to the new record. */
    @PostMapping("/{id}/ingest")
    public ApiResponse<CatalogIngestRequestDto> ingest(@PathVariable Long id) {
        return ApiResponse.success(
                service.ingest(id, userContext.userId(), userContext.email())
        );
    }

    /**
     * Mark fulfilled without ingesting TMDB metadata — admin uploaded the file directly
     * and voters can find it via search. No record is created.
     */
    @PostMapping("/{id}/fulfill-no-ingest")
    public ApiResponse<CatalogIngestRequestDto> fulfillNoIngest(@PathVariable Long id) {
        return ApiResponse.success(
                service.markFulfilledNoIngest(id, userContext.userId(), userContext.email())
        );
    }

    /** Dismiss with optional reason — voters are notified. Body: {@code { "reason": "..." }} optional. */
    @PostMapping("/{id}/dismiss")
    public ApiResponse<CatalogIngestRequestDto> dismiss(
            @PathVariable Long id,
            @RequestBody(required = false) DismissRequest body
    ) {
        String reason = body != null ? body.reason() : null;
        return ApiResponse.success(
                service.dismiss(id, reason, userContext.userId(), userContext.email())
        );
    }

    @PostMapping("/{id}/reopen")
    public ApiResponse<CatalogIngestRequestDto> reopen(@PathVariable Long id) {
        return ApiResponse.success(service.reopen(id));
    }

    public record DismissRequest(String reason) {}
}
