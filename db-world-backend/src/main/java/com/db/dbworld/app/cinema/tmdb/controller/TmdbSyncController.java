package com.db.dbworld.app.cinema.tmdb.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.enums.SyncStatus;
import com.db.dbworld.app.cinema.tmdb.sync.dto.SyncRecordDto;
import com.db.dbworld.app.cinema.tmdb.sync.dto.SyncStatsDto;
import com.db.dbworld.app.cinema.tmdb.sync.service.TmdbSyncAdminService;
import com.db.dbworld.core.role.annotations.AdminAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cinema/admin/tmdb/sync")
@RequiredArgsConstructor
public class TmdbSyncController {

    private final TmdbSyncAdminService syncAdminService;

    /* ── Stats ── */

    @AdminAccess
    @GetMapping("/stats")
    public ApiResponse<SyncStatsDto> stats() {
        return ApiResponse.success(syncAdminService.getStats());
    }

    /* ── Records (paginated) ── */

    @AdminAccess
    @GetMapping("/records")
    public ApiResponse<Page<SyncRecordDto>> records(
            @RequestParam(required = false) SyncStatus status,
            @RequestParam(required = false) RecordType recordType,
            Pageable pageable
    ) {
        return ApiResponse.success(syncAdminService.getRecords(status, recordType, pageable));
    }

    /* ── Trigger ── */

    @AdminAccess
    @PostMapping("/trigger")
    public ApiResponse<Void> trigger(
            @RequestParam(required = false) RecordType type
    ) {
        syncAdminService.triggerSync(type);
        return ApiResponse.success("Sync triggered" + (type != null ? " for " + type : ""));
    }

    /* ── Retry ── */

    @AdminAccess
    @PostMapping("/retry/{id}")
    public ApiResponse<Void> retry(@PathVariable Long id) {
        syncAdminService.retrySync(id);
        return ApiResponse.success("Retry queued for id " + id);
    }

    /* ── Force Sync (re-sync all records, bypasses shouldSync guard) ── */

    @AdminAccess
    @PostMapping("/force")
    public ApiResponse<Void> force(
            @RequestParam(required = false) RecordType type
    ) {
        syncAdminService.forceSync(type);
        return ApiResponse.success("Force sync started" + (type != null ? " for " + type : " for all records"));
    }
}
