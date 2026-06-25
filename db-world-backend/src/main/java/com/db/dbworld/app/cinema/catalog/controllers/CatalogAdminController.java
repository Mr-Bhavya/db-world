package com.db.dbworld.app.cinema.catalog.controllers;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.catalog.dto.RecordAdminRowDto;
import com.db.dbworld.app.cinema.catalog.dto.RecordDto;
import com.db.dbworld.app.cinema.catalog.dto.request.AddTagRequest;
import com.db.dbworld.app.cinema.catalog.dto.request.CreateRecordRequest;
import com.db.dbworld.app.cinema.catalog.dto.request.UpdateRecordRequest;
import com.db.dbworld.app.cinema.catalog.service.CatalogService;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.core.role.annotations.AdminAccess;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cinema/admin/catalog")
@RequiredArgsConstructor
public class CatalogAdminController {

    private final CatalogService catalogService;

    /* =========================
       GET RECORD (admin)
       ========================= */

    @AdminAccess
    @GetMapping("/{id}")
    public ApiResponse<RecordDto> getRecord(@PathVariable Long id) {
        return ApiResponse.success(catalogService.getRecord(id));
    }

    /* =========================
       CREATE RECORD
       ========================= */

    @AdminAccess
    @PostMapping
    public ApiResponse<RecordDto> create(@Valid @RequestBody CreateRecordRequest request) {

        return ApiResponse.success("Record created", catalogService.createRecord(request));
    }

    /* =========================
       VISIBILITY (hide from rails)
       ========================= */

    @AdminAccess
    @PatchMapping("/{id}/visibility")
    public ApiResponse<RecordDto> setVisibility(
            @PathVariable Long id,
            @RequestParam boolean hideFromRails
    ) {

        return ApiResponse.success(
                hideFromRails ? "Record hidden from rails" : "Record visible on rails",
                catalogService.setHideFromRails(id, hideFromRails)
        );
    }

    /* =========================
       REFRESH FROM TMDB (re-sync a single record)
       ========================= */

    @AdminAccess
    @PostMapping("/{id}/refresh")
    public ApiResponse<RecordDto> refresh(@PathVariable Long id) {
        return ApiResponse.success(
                "Record synced from TMDB",
                catalogService.refreshRecord(id)
        );
    }

    /* =========================
       UPDATE RECORD
       ========================= */

    @AdminAccess
    @PutMapping("/{id}")
    public ApiResponse<RecordDto> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateRecordRequest request
    ) {

        return ApiResponse.success(
                "Record updated",
                catalogService.updateRecord(id, request)
        );
    }

    /* =========================
       DELETE RECORD
       ========================= */

    @AdminAccess
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {

        catalogService.deleteRecord(id);

        return ApiResponse.success("Record deleted");
    }

    /* =========================
       Admin Table
     ========================= */

    @AdminAccess
    @GetMapping("/table")
    public ApiResponse<Page<RecordAdminRowDto>> table(
            @RequestParam(required = false) Long recordId,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) RecordType type,
            @RequestParam(required = false) Long tmdbId,
            @RequestParam(required = false) Integer year,
            Pageable pageable
    ) {

        return ApiResponse.success(
                catalogService.getAdminTable(
                        recordId,
                        name,
                        type,
                        tmdbId,
                        year,
                        pageable
                )
        );
    }

    @AdminAccess
    @PostMapping("/{recordId}/tags")
    public ApiResponse<Void> addTag(
            @PathVariable Long recordId,
            @Valid @RequestBody AddTagRequest request
    ) {

        catalogService.addTag(recordId, request);

        return ApiResponse.success("Tag assigned");
    }

    @AdminAccess
    @DeleteMapping("/{recordId}/tags/{tagType}")
    public ApiResponse<Void> removeTag(
            @PathVariable Long recordId,
            @PathVariable RecordTagType tagType
    ) {

        catalogService.removeTag(recordId, tagType);

        return ApiResponse.success("Tag removed");
    }
}