package com.db.dbworld.app.cinema.catalog.controllers;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.cinema.catalog.dto.RecordAdminRowDto;
import com.db.dbworld.cinema.catalog.dto.RecordDto;
import com.db.dbworld.cinema.catalog.dto.request.AddTagRequest;
import com.db.dbworld.cinema.catalog.dto.request.CreateRecordRequest;
import com.db.dbworld.cinema.catalog.dto.request.UpdateRecordRequest;
import com.db.dbworld.cinema.catalog.service.CatalogService;
import com.db.dbworld.cinema.enums.RecordTagType;
import com.db.dbworld.cinema.enums.RecordType;
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
       CREATE RECORD
       ========================= */

    @PostMapping
    public ApiResponse<RecordDto> create(@Valid @RequestBody CreateRecordRequest request) {

        return ApiResponse.success("Record created", catalogService.createRecord(request));
    }

    /* =========================
       UPDATE RECORD
       ========================= */

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

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {

        catalogService.deleteRecord(id);

        return ApiResponse.success("Record deleted");
    }

    /* =========================
       Admin Table
     ========================= */

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


    @PostMapping("/{recordId}/tags")
    public ApiResponse<Void> addTag(
            @PathVariable Long recordId,
            @Valid @RequestBody AddTagRequest request
    ) {

        catalogService.addTag(recordId, request);

        return ApiResponse.success("Tag assigned");
    }

    @DeleteMapping("/{recordId}/tags/{tagType}")
    public ApiResponse<Void> removeTag(
            @PathVariable Long recordId,
            @PathVariable RecordTagType tagType
    ) {

        catalogService.removeTag(recordId, tagType);

        return ApiResponse.success("Tag removed");
    }
}