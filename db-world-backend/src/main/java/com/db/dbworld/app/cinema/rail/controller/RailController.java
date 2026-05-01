package com.db.dbworld.app.cinema.rail.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.enums.PageType;
import com.db.dbworld.app.cinema.rail.dto.RailDto;
import com.db.dbworld.app.cinema.rail.dto.RailPageDto;
import com.db.dbworld.app.cinema.rail.dto.RailRequest;
import com.db.dbworld.app.cinema.rail.service.RailService;
import com.db.dbworld.app.cinema.tmdb.genre.dto.GenreDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cinema")
@RequiredArgsConstructor
public class RailController {

    private final RailService railService;

    /* ================================================================
       CATEGORIES — Genre dropdown per page (like Netflix)
       Called once on page load to populate the category filter.
    ================================================================= */

    @GetMapping("/home/categories")
    public ApiResponse<List<GenreDto>> homeCategories() {
        return ApiResponse.success(railService.getCategories(PageType.HOME));
    }

    @GetMapping("/movies/categories")
    public ApiResponse<List<GenreDto>> movieCategories() {
        return ApiResponse.success(railService.getCategories(PageType.MOVIES));
    }

    @GetMapping("/series/categories")
    public ApiResponse<List<GenreDto>> seriesCategories() {
        return ApiResponse.success(railService.getCategories(PageType.SERIES));
    }

    /* ================================================================
       PAGE ENDPOINTS — Step 1: Load rail metadata (lightweight)
       Optional ?category=28 filters rails + records to that genre.
    ================================================================= */

    @GetMapping("/home")
    public ApiResponse<List<RailDto>> home(
            @RequestParam(required = false) Long category
    ) {
        return ApiResponse.success(railService.getRails(PageType.HOME, category));
    }

    @GetMapping("/movies")
    public ApiResponse<List<RailDto>> movies(
            @RequestParam(required = false) Long category
    ) {
        return ApiResponse.success(railService.getRails(PageType.MOVIES, category));
    }

    @GetMapping("/series")
    public ApiResponse<List<RailDto>> series(
            @RequestParam(required = false) Long category
    ) {
        return ApiResponse.success(railService.getRails(PageType.SERIES, category));
    }

    /* ================================================================
       RAIL RECORDS — Step 2: Load records per rail (lazy / on-scroll)
       Optional ?category=28 filters records to that genre.
    ================================================================= */

    @GetMapping("/rails/{railId}/records")
    public ApiResponse<RailPageDto> getRailRecords(
            @PathVariable Long railId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Long category
    ) {
        return ApiResponse.success(
                railService.getRailRecords(railId, page, size, category)
        );
    }

    /* ================================================================
       ADMIN / CRUD ENDPOINTS
    ================================================================= */

    @GetMapping("/rails")
    public ApiResponse<List<RailDto>> getRails(
            @RequestParam(required = false) PageType pageType
    ) {
        return ApiResponse.success(
                "Rails loaded successfully",
                railService.getRails(pageType)
        );
    }

    @GetMapping("/rails/{railId}")
    public ApiResponse<RailDto> getRail(@PathVariable Long railId) {
        return ApiResponse.success(railService.getRail(railId));
    }

    @PostMapping("/rails")
    public ApiResponse<RailDto> createRail(@RequestBody RailRequest request) {
        return ApiResponse.success(
                "Rail created successfully",
                railService.createRail(request)
        );
    }

    @PutMapping("/rails/{railId}")
    public ApiResponse<RailDto> updateRail(
            @PathVariable Long railId,
            @RequestBody RailRequest request
    ) {
        return ApiResponse.success(
                "Rail updated successfully",
                railService.updateRail(railId, request)
        );
    }

    @DeleteMapping("/rails/{railId}")
    public ApiResponse<Void> deleteRail(@PathVariable Long railId) {
        railService.deleteRail(railId);
        return ApiResponse.success("Rail deleted successfully");
    }

    @PostMapping("/rails/{railId}/records/{recordId}")
    public ApiResponse<Void> addRecordToRail(
            @PathVariable Long railId,
            @PathVariable Long recordId,
            @RequestParam Integer priority
    ) {
        railService.addRecordToRail(railId, recordId, priority);
        return ApiResponse.success("Record added to rail");
    }

    @DeleteMapping("/rails/items/{railItemId}")
    public ApiResponse<Void> removeRailItem(@PathVariable Long railItemId) {
        railService.removeRailItem(railItemId);
        return ApiResponse.success("Record removed from rail");
    }
}
