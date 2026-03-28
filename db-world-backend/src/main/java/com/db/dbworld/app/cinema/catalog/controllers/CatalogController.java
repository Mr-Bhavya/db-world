package com.db.dbworld.app.cinema.catalog.controllers;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.cinema.catalog.dto.RecordAutocompleteDto;
import com.db.dbworld.cinema.catalog.dto.RecordDto;
import com.db.dbworld.cinema.catalog.service.CatalogService;
import com.db.dbworld.cinema.catalog.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
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

    @GetMapping("/{id}")
    public ApiResponse<RecordDto> getRecord(@PathVariable Long id) {

        RecordDto record = catalogService.getRecord(id);

        return ApiResponse.success(record);
    }

    /* =========================
       SEARCH
       ========================= */

    @GetMapping("/search")
    public ApiResponse<Page<RecordDto>> search(
            @RequestParam String q,
            Pageable pageable
    ) {

        Page<RecordDto> result = searchService.search(q, pageable);

        return ApiResponse.success(result);
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