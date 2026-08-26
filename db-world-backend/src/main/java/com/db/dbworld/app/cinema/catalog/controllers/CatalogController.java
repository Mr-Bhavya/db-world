package com.db.dbworld.app.cinema.catalog.controllers;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.api.response.PageResponse;
import com.db.dbworld.app.cinema.catalog.dto.RecordAutocompleteDto;
import com.db.dbworld.app.cinema.catalog.dto.RecordDto;
import com.db.dbworld.app.cinema.catalog.dto.SearchRecordDto;
import com.db.dbworld.app.cinema.catalog.service.CatalogService;
import com.db.dbworld.app.cinema.catalog.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Public read surface for the catalog.
 *
 * <p>No {@code @AnyRole} on these methods, deliberately. Opening the browse pages to
 * anonymous visitors needs BOTH halves: {@code PUBLIC_GET_APIS} lets the request past
 * the filter chain, and the absence of a {@code @PreAuthorize} lets it past method
 * security. With only the first, every one of these 500s for a signed-out visitor —
 * {@code AuthorizationDeniedException} is thrown after the filter chain has already
 * allowed the request through.
 *
 * <p>Draft records are still not disclosed: {@code getPublicRecord} 404s them, and the
 * rail-backed reads run under the {@code excludeHidden} filter.
 */
@RestController
@RequestMapping("/api/cinema/catalog")
@RequiredArgsConstructor
public class CatalogController {

    private final SearchService searchService;
    private final CatalogService catalogService;

    /* =========================
       GET RECORD
       ========================= */

    @GetMapping("/{id}")
    public ApiResponse<RecordDto> getRecord(@PathVariable Long id) {

        // Public read — a DRAFT (unpublished) record 404s here, but stays visible to admins.
        RecordDto record = catalogService.getPublicRecord(id);

        return ApiResponse.success(record);
    }

    /* =========================
       MORE LIKE THIS
       ========================= */

    @GetMapping("/{id}/similar")
    public ApiResponse<List<SearchRecordDto>> getSimilar(
            @PathVariable Long id,
            @RequestParam(defaultValue = "12") int limit
    ) {
        return ApiResponse.success(catalogService.getSimilar(id, Math.min(Math.max(limit, 1), 30)));
    }

    /* =========================
       SEARCH
       ========================= */

    @GetMapping("/search")
    public ApiResponse<PageResponse<SearchRecordDto>> search(
            @RequestParam String q,
            Pageable pageable
    ) {

        return ApiResponse.success(PageResponse.of(searchService.search(q, pageable)));
    }

    /* =========================
       AUTOCOMPLETE
       ========================= */

    @GetMapping("/autocomplete")
    public ApiResponse<List<RecordAutocompleteDto>> autocomplete(
            @RequestParam String q
    ) {

        List<RecordAutocompleteDto> result = searchService.autocomplete(q, 10).toList();

        return ApiResponse.success(result);
    }
}