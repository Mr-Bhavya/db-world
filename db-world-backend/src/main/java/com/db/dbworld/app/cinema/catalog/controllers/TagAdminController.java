package com.db.dbworld.app.cinema.catalog.controllers;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.catalog.dto.RecordAdminRowDto;
import com.db.dbworld.app.cinema.catalog.dto.RecordTagDto;
import com.db.dbworld.app.cinema.catalog.dto.TagSummaryDto;
import com.db.dbworld.app.cinema.catalog.tags.entity.TagDefinitionEntity;
import com.db.dbworld.app.cinema.catalog.tags.services.TagAdminService;
import com.db.dbworld.app.cinema.catalog.tags.services.TagDefinitionService;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import com.db.dbworld.app.cinema.rail.util.RailSortBuilder;
import com.db.dbworld.core.role.annotations.AdminAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/cinema/admin/tags")
@RequiredArgsConstructor
public class TagAdminController {

    private final TagAdminService tagAdminService;
    private final TagDefinitionService tagDefinitionService;

    /* =========================
       SUMMARY
       ========================= */

    @AdminAccess
    @GetMapping("/summary")
    public ApiResponse<List<TagSummaryDto>> summary() {
        return ApiResponse.success(tagAdminService.getTagSummary());
    }

    /* =========================
       RECORDS BY TAG
       ========================= */

    @AdminAccess
    @GetMapping("/{tagType}/records")
    public ApiResponse<Page<RecordAdminRowDto>> recordsByTag(
            @PathVariable RecordTagType tagType,
            Pageable pageable
    ) {
        return ApiResponse.success(tagAdminService.getRecordsByTag(tagType, pageable));
    }

    /* =========================
       BULK ADD
       ========================= */

    @AdminAccess
    @PostMapping("/{tagType}/bulk-add")
    public ApiResponse<Map<String, Integer>> bulkAdd(
            @PathVariable RecordTagType tagType,
            @RequestBody BulkTagRequest request
    ) {
        int added = tagAdminService.bulkAdd(tagType, request.recordIds(), request.priority());
        return ApiResponse.success(Map.of("added", added));
    }

    /* =========================
       BULK REMOVE
       ========================= */

    @AdminAccess
    @DeleteMapping("/{tagType}/bulk-remove")
    public ApiResponse<Map<String, Integer>> bulkRemove(
            @PathVariable RecordTagType tagType,
            @RequestBody BulkRemoveRequest request
    ) {
        int removed = tagAdminService.bulkRemove(tagType, request.recordIds());
        return ApiResponse.success(Map.of("removed", removed));
    }

    /* =========================
       RECALCULATE
       ========================= */

    @AdminAccess
    @PostMapping("/{tagType}/recalculate")
    public ApiResponse<Void> recalculate(@PathVariable RecordTagType tagType) {
        tagAdminService.recalculateOne(tagType);
        return ApiResponse.success("Tag recalculated: " + tagType);
    }

    @AdminAccess
    @PostMapping("/recalculate-all")
    public ApiResponse<Void> recalculateAll() {
        tagAdminService.recalculateAll();
        return ApiResponse.success("All tags recalculated");
    }

    /* =========================
       SINGLE-RECORD TAG CRUD
       (merged from RecordTagController)
       ========================= */

    @AdminAccess
    @PostMapping("/record/{recordId}")
    public ApiResponse<RecordTagDto> addTagToRecord(
            @PathVariable Long recordId,
            @RequestBody RecordTagDto dto
    ) {
        return ApiResponse.success(tagAdminService.addTagToRecord(recordId, dto));
    }

    @AdminAccess
    @PutMapping("/entry/{tagId}")
    public ApiResponse<RecordTagDto> updateTagEntry(
            @PathVariable Long tagId,
            @RequestBody RecordTagDto dto
    ) {
        return ApiResponse.success(tagAdminService.updateTagPriority(tagId, dto));
    }

    @AdminAccess
    @DeleteMapping("/entry/{tagId}")
    public ApiResponse<Void> deleteTagEntry(@PathVariable Long tagId) {
        tagAdminService.deleteTagEntry(tagId);
        return ApiResponse.success("Tag removed");
    }

    /* =========================
       TAG DEFINITIONS
       Single source of truth for each tag's display config, default sort,
       pool size, and active state.
       ========================= */

    @AdminAccess
    @GetMapping("/definitions")
    public ApiResponse<List<TagDefinitionEntity>> listDefinitions() {
        return ApiResponse.success(tagDefinitionService.findAll());
    }

    @AdminAccess
    @PutMapping("/definitions/{tagType}")
    public ApiResponse<TagDefinitionEntity> updateDefinition(
            @PathVariable String tagType,
            @RequestBody UpdateDefinitionRequest req
    ) {
        TagDefinitionEntity updated = tagDefinitionService.update(
                tagType.toUpperCase(),
                req.displayName(),
                req.description(),
                req.active(),
                req.defaultSort(),
                req.defaultDirection(),
                req.poolSize(),
                req.refreshCron()
        );
        return ApiResponse.success(updated);
    }

    /* =========================
       RAIL METADATA
       Returns available dropdown options for the rail editor UI.
       ========================= */

    @AdminAccess
    @GetMapping("/rail-metadata")
    public ApiResponse<Map<String, Object>> railMetadata() {
        return ApiResponse.success(Map.of(
                "sortFields",   RailSortBuilder.availableFields().stream().sorted().collect(Collectors.toList()),
                "ruleTypes",    List.of("tag", "genre", "language", "filter", "manual"),
                "pageTypes",    List.of("HOME", "MOVIES", "SERIES"),
                "recordTypes",  List.of("MOVIE", "TV_SERIES"),
                "tagTypes",     Arrays.stream(RecordTagType.values()).map(Enum::name).collect(Collectors.toList())
        ));
    }

    /* =========================
       REQUEST RECORDS
       ========================= */

    record BulkTagRequest(List<Long> recordIds, int priority) {}
    record BulkRemoveRequest(List<Long> recordIds) {}
    record UpdateDefinitionRequest(
            String displayName,
            String description,
            boolean active,
            String defaultSort,
            String defaultDirection,
            int poolSize,
            String refreshCron
    ) {}
}
