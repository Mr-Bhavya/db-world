package com.db.dbworld.app.ipo.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.ipo.dto.IpoChangeDto;
import com.db.dbworld.app.ipo.dto.IpoDuplicateDto;
import com.db.dbworld.app.ipo.dto.IpoStatusPreviewDto;
import com.db.dbworld.app.ipo.dto.SourceHealthDto;
import com.db.dbworld.app.ipo.service.IpoAdminService;
import com.db.dbworld.app.ipo.service.IpoDuplicateService;
import com.db.dbworld.core.role.annotations.AdminAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin-only IPO tracker console: source-health visibility, the recent change feed, a manual
 * re-poll, and the duplicate-listing review. Cadence editing is not here — {@code ipo-poll}'s cron
 * lives on the existing admin Scheduler page like every other scheduled job.
 */
@RestController
@RequestMapping("/api/admin/ipo")
@RequiredArgsConstructor
@AdminAccess
public class IpoAdminController {

    private final IpoAdminService adminService;
    private final IpoDuplicateService duplicateService;

    @GetMapping("/sources")
    public ApiResponse<List<SourceHealthDto>> sources() {
        return ApiResponse.success(adminService.sourceHealth());
    }

    /** Without parameters: the latest 50 (unchanged). {@code type}/{@code before}/{@code limit} page and filter the feed. */
    @GetMapping("/changes")
    public ApiResponse<List<IpoChangeDto>> changes(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) java.time.Instant before,
            @RequestParam(required = false) String beforeId,
            @RequestParam(required = false) Integer limit) {
        if (type == null && before == null && beforeId == null && limit == null) {
            return ApiResponse.success(adminService.recentChanges());
        }
        return ApiResponse.success(adminService.recentChanges(
                type, before, beforeId, limit != null ? limit : 50));
    }

    /** DRY RUN of the next status sweep — read-only. */
    @GetMapping("/status-preview")
    public ApiResponse<IpoStatusPreviewDto.Report> statusPreview() {
        return ApiResponse.success(adminService.statusPreview());
    }

    @PostMapping("/repoll")
    public ApiResponse<Void> repoll() {
        adminService.repoll();
        return ApiResponse.success("Re-poll triggered");
    }

    /**
     * DRY RUN. Every duplicate cluster the merge would act on, with both names, both match keys,
     * both sets of dates and — the number that actually matters — how many users' "My IPOs" entries
     * each row holds. Read-only; nothing is changed until {@link #mergeDuplicates} is called.
     */
    @GetMapping("/duplicates")
    public ApiResponse<List<IpoDuplicateDto.Cluster>> duplicates() {
        return ApiResponse.success(duplicateService.report());
    }

    /**
     * Applies the merge. With no body every cluster in the report is merged; pass a list of alias
     * keys to approve only some. Merged rows are tombstoned; child records move to the survivor.
     */
    @PostMapping("/duplicates/merge")
    public ApiResponse<IpoDuplicateDto.MergeResult> mergeDuplicates(
            @RequestBody(required = false) IpoDuplicateDto.MergeRequest request) {
        List<String> aliasKeys = request == null ? List.of() : request.aliasKeys();
        IpoDuplicateDto.MergeResult result;
        if (aliasKeys == null || aliasKeys.isEmpty()) {
            result = duplicateService.mergeAll();
        } else {
            result = duplicateService.merge(aliasKeys, request != null && request.resolveConflicts());
        }
        return ApiResponse.success("Merged " + result.rowsMerged() + " duplicate row(s)", result);
    }
}
