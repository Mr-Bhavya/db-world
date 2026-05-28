package com.db.dbworld.app.cinema.catalog.controllers;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.api.response.PageResponse;
import com.db.dbworld.app.cinema.catalog.dto.RecordAutocompleteDto;
import com.db.dbworld.app.cinema.catalog.dto.RecordDto;
import com.db.dbworld.app.cinema.catalog.dto.SearchRecordDto;
import com.db.dbworld.app.cinema.catalog.service.CatalogService;
import com.db.dbworld.app.cinema.catalog.service.SearchService;
import com.db.dbworld.core.role.annotations.AnyRole;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cinema/catalog")
@RequiredArgsConstructor
public class CatalogController {

    private final SearchService searchService;
    private final CatalogService catalogService;

    /* =========================
       GET RECORD
       ========================= */

    @AnyRole
    @GetMapping("/{id}")
    public ApiResponse<RecordDto> getRecord(@PathVariable Long id) {

        RecordDto record = catalogService.getRecord(id);

        return ApiResponse.success(record);
    }

    /* =========================
       MORE LIKE THIS
       ========================= */

    @AnyRole
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

    @AnyRole
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

    @AnyRole
    @GetMapping("/autocomplete")
    public ApiResponse<List<RecordAutocompleteDto>> autocomplete(
            @RequestParam String q
    ) {

        List<RecordAutocompleteDto> result = searchService.autocomplete(q, 10).toList();

        return ApiResponse.success(result);
    }
}