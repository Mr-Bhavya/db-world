package com.db.dbworld.app.cinema.tmdb.search.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.search.dto.TmdbSearchItemDto;
import com.db.dbworld.app.cinema.tmdb.search.service.TmdbSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Authenticated, non-admin TMDB search — used by the cinema-side "request a title"
 * flow so users can find a TMDB result to back their catalog ingest request.
 * The admin search lives at /api/cinema/admin/tmdb/search and is unchanged.
 */
@RestController
@RequestMapping("/api/cinema/tmdb")
@RequiredArgsConstructor
public class TmdbPublicSearchController {

    private final TmdbSearchService tmdbSearchService;

    /** GET /api/cinema/tmdb/search?type=MOVIE&query=...&year=... */
    @GetMapping("/search")
    public ApiResponse<List<TmdbSearchItemDto>> search(
            @RequestParam RecordType type,
            @RequestParam String query,
            @RequestParam(required = false, defaultValue = "en-US") String language,
            @RequestParam(required = false) Integer year
    ) {
        return ApiResponse.success(tmdbSearchService.search(type, query, language, year));
    }
}
