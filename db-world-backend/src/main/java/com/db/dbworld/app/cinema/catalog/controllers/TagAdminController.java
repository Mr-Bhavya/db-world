package com.db.dbworld.app.cinema.catalog.controllers;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.catalog.dto.RecordAdminRowDto;
import com.db.dbworld.app.cinema.catalog.dto.RecordTagDto;
import com.db.dbworld.app.cinema.catalog.dto.TagSummaryDto;
import com.db.dbworld.app.cinema.catalog.tags.entity.TagDefinitionEntity;
import com.db.dbworld.app.cinema.catalog.tags.rule.FilterFieldRegistry;
import com.db.dbworld.app.cinema.catalog.tags.rule.RuleTagRefresher;
import com.db.dbworld.app.cinema.catalog.tags.rule.TagRule;
import com.db.dbworld.app.cinema.catalog.tags.services.TagAdminService;
import com.db.dbworld.app.cinema.catalog.tags.services.TagDefinitionService;
import com.db.dbworld.app.cinema.catalog.tags.services.TagNames;
import com.db.dbworld.app.cinema.rail.rule.RailRuleTypes;
import com.db.dbworld.app.cinema.tmdb.genre.repository.GenreRepository;
import com.db.dbworld.app.cinema.tmdb.providers.repository.ProviderRepository;
import com.db.dbworld.app.cinema.rail.util.RailSortBuilder;
import com.db.dbworld.core.role.annotations.AdminAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/cinema/admin/tags")
@RequiredArgsConstructor
public class TagAdminController {

    private final TagAdminService tagAdminService;
    private final TagDefinitionService tagDefinitionService;
    private final RailSortBuilder railSortBuilder;
    private final RuleTagRefresher ruleTagRefresher;
    private final ProviderRepository providerRepository;
    private final FilterFieldRegistry filterFieldRegistry;
    private final GenreRepository genreRepository;

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
            @PathVariable String tagType,
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
            @PathVariable String tagType,
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
            @PathVariable String tagType,
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
    public ApiResponse<Void> recalculate(@PathVariable String tagType) {
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

    /**
     * Removes a tag from a record by tag NAME — the inline chips in the records table know the tag
     * but not its row id. Replaces the old {@code DELETE /catalog/{recordId}/tags/{tagType}}, which
     * skipped the automatic-tag guard.
     */
    @AdminAccess
    @DeleteMapping("/record/{recordId}/{tagType}")
    public ApiResponse<Map<String, Boolean>> removeTagFromRecord(
            @PathVariable Long recordId,
            @PathVariable String tagType
    ) {
        boolean removed = tagAdminService.removeTagFromRecord(recordId, tagType);
        return ApiResponse.success(removed ? "Tag removed" : "Record did not carry that tag",
                Map.of("removed", removed));
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
       Single source of truth for each tag's display config, default sort and
       active state — and the list of tags that exist at all.
       ========================= */

    @AdminAccess
    @GetMapping("/definitions")
    public ApiResponse<List<TagDefinitionEntity>> listDefinitions() {
        return ApiResponse.success(tagDefinitionService.findAll());
    }

    /**
     * Creates a new admin-curated tag. Always manual — no strategy computes it, so its records are
     * whatever an admin puts there. The name is slugged to UPPER_SNAKE; {@code displayName} keeps
     * the human wording.
     */
    @AdminAccess
    @PostMapping("/definitions")
    public ApiResponse<TagDefinitionEntity> createDefinition(@RequestBody CreateDefinitionRequest req) {
        TagDefinitionEntity created = tagDefinitionService.create(
                req.name(),
                req.displayName(),
                req.description(),
                req.defaultSort(),
                req.defaultDirection(),
                req.rule()
        );
        return ApiResponse.success("Tag created: " + created.getTagType(), created);
    }

    @AdminAccess
    @PutMapping("/definitions/{tagType}")
    public ApiResponse<TagDefinitionEntity> updateDefinition(
            @PathVariable String tagType,
            @RequestBody UpdateDefinitionRequest req
    ) {
        TagDefinitionEntity updated = tagDefinitionService.update(
                TagNames.canonicalize(tagType),
                req.displayName(),
                req.description(),
                req.active(),
                req.defaultSort(),
                req.defaultDirection(),
                req.rule()
        );
        return ApiResponse.success(updated);
    }

    /**
     * Deletes an admin-created tag and every record_tags row carrying it. Built-in tags are
     * refused — switch them off with the Active toggle instead.
     */
    @AdminAccess
    @DeleteMapping("/definitions/{tagType}")
    public ApiResponse<Map<String, Long>> deleteDefinition(@PathVariable String tagType) {
        long removed = tagDefinitionService.delete(tagType);
        return ApiResponse.success("Tag deleted", Map.of("recordsUntagged", removed));
    }

    /**
     * Dry-runs a rule and reports what it would tag, without writing anything. Lets an admin see
     * "42 records would match" before a rule replaces a live tag's membership.
     */
    @AdminAccess
    @PostMapping("/definitions/preview")
    public ApiResponse<Map<String, Object>> previewRule(@RequestBody PreviewRuleRequest req) {
        if (req.rule() == null || req.rule().isEmpty()) {
            return ApiResponse.success(Map.of(
                    "matched", 0,
                    "recordIds", List.of(),
                    "message", "Add at least one condition — an empty rule would match everything."));
        }
        int limit = req.limit() == null || req.limit() <= 0 ? 60 : req.limit();
        List<Long> ids = ruleTagRefresher.preview(req.rule(), limit);
        return ApiResponse.success(Map.of(
                "matched",   ids.size(),
                "recordIds", ids,
                "cappedAt",  limit));
    }

    /* =========================
       RAIL METADATA
       Returns available dropdown options for the rail editor UI.
       ========================= */

    @AdminAccess
    @GetMapping("/rail-metadata")
    public ApiResponse<Map<String, Object>> railMetadata() {
        return ApiResponse.success(Map.of(
                // [{ value, label }] — label included so a new sort field needs no frontend edit.
                "sortFields",   railSortBuilder.availableFields(),
                // [{ value, label, description }] from the single registry, so a new rule type
                // needs no frontend edit. RailRuleTypesTest asserts parity with the resolver.
                "ruleTypes",    RailRuleTypes.all(),
                "pageTypes",    List.of("HOME", "MOVIES", "SERIES"),
                "recordTypes",  List.of("MOVIE", "TV_SERIES"),
                // From tag_definitions, not RecordTagType.values() — admin-created tags have to be
                // selectable when building a rail, which is the whole point of them existing.
                "tagTypes",     tagDefinitionService.findAll().stream()
                                        .map(TagDefinitionEntity::getTagType)
                                        .collect(Collectors.toList()),
                // Watch providers actually present in the catalogue, for the tag-rule builder's
                // "only on Netflix / Hotstar / Prime" filter. Only in-use ones — TMDB knows
                // hundreds worldwide and the ingest stores every one it sees.
                "providers",    providerRepository.findInUse().stream()
                                        .map(p -> Map.of(
                                                "id",      (Object) p.getId(),
                                                "name",    p.getName() == null ? "" : p.getName(),
                                                "logoPath", p.getLogoPath() == null ? "" : p.getLogoPath()))
                                        .collect(Collectors.toList()),
                "providerTypes", List.of("FLATRATE", "RENT", "BUY", "NETWORK"),
                // Everything a tag rule can filter on, discovered from the JPA metamodel — each with
                // its type, the operators legal for that type, and any enum options. This is what
                // lets the rule builder be three dropdowns instead of a query language, and why a
                // new column becomes filterable with no frontend change.
                "filterFields",  filterFieldRegistry.availableFields(),
                // Genres in use, so the rule builder's Genre picker can show names instead of
                // making an admin look up TMDB numeric ids.
                "genres",        genreRepository.findActiveGenres().stream()
                                        .map(g -> Map.of("id", (Object) g.getId(),
                                                         "name", g.getName() == null ? "" : g.getName()))
                                        .collect(Collectors.toList())
        ));
    }

    /* =========================
       REQUEST RECORDS
       ========================= */

    record BulkTagRequest(List<Long> recordIds, int priority) {}
    record BulkRemoveRequest(List<Long> recordIds) {}
    record CreateDefinitionRequest(
            String name,
            String displayName,
            String description,
            String defaultSort,
            String defaultDirection,
            /** Optional. Present = the tag auto-populates from this rule; absent = manual list. */
            TagRule rule
    ) {}
    record PreviewRuleRequest(TagRule rule, Integer limit) {}
    record UpdateDefinitionRequest(
            String displayName,
            String description,
            boolean active,
            String defaultSort,
            String defaultDirection,
            TagRule rule
    ) {}
}
