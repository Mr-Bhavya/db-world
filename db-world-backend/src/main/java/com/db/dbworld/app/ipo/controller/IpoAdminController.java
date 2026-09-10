package com.db.dbworld.app.ipo.controller;

import com.db.dbworld.app.ipo.dto.IpoChangeDto;
import com.db.dbworld.app.ipo.dto.IpoDuplicateDto;
import com.db.dbworld.app.ipo.dto.SourceHealthDto;
import com.db.dbworld.app.ipo.service.IpoAdminService;
import com.db.dbworld.app.ipo.service.IpoDuplicateService;
import com.db.dbworld.core.role.annotations.AdminAccess;
import com.db.dbworld.payloads.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
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

    @GetMapping("/changes")
    public ApiResponse<List<IpoChangeDto>> changes() {
        return ApiResponse.success(adminService.recentChanges());
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
     * keys to approve only some. Reversible either way — a merged row is tombstoned via
     * {@code merged_into_id}, never deleted.
     */
    @PostMapping("/duplicates/merge")
    public ApiResponse<IpoDuplicateDto.MergeResult> mergeDuplicates(
            @RequestBody(required = false) List<String> aliasKeys) {
        IpoDuplicateDto.MergeResult result = aliasKeys == null || aliasKeys.isEmpty()
                ? duplicateService.mergeAll()
                : duplicateService.merge(aliasKeys);
        return ApiResponse.success("Merged " + result.rowsMerged() + " duplicate row(s)", result);
    }
}
