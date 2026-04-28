package com.db.dbworld.app.media.admin.controller;

import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.app.media.link.SymlinkService;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.utils.DbWorldConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

@Log4j2
@RestController
@RequestMapping("/api/admin/media")
@PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
@RequiredArgsConstructor
public class MediaAdminController {

    private final MediaInfoService mediaInfoService;
    private final SymlinkService   symlinkService;

    /* ── File info ───────────────────────────────────────────────────── */

    @GetMapping("/files")
    public ResponseEntity<ApiResponse<List<MediaFileDto>>> getAllMediaFiles() {
        return ResponseEntity.ok(ApiResponse.success(mediaInfoService.findAll()));
    }

    @GetMapping("/files/{id}")
    public ResponseEntity<ApiResponse<MediaFileDto>> getMediaFileById(@PathVariable String id) {
        return mediaInfoService.getById(id)
                .map(dto -> ResponseEntity.ok(ApiResponse.success(dto)))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error(404, "MediaFile not found: " + id, (MediaFileDto) null)));
    }

    @DeleteMapping("/files/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteMediaFile(
            @PathVariable String id,
            @RequestParam(defaultValue = "false") boolean purge) {
        mediaInfoService.getById(id).ifPresent(dto -> {
            if (purge) deleteActualFile(dto.getFilePath(), id);
            symlinkService.deleteById(id);
            mediaInfoService.deleteByFilePath(dto.getFilePath());
        });
        return ResponseEntity.ok(ApiResponse.success(purge ? "Permanently deleted" : "Removed from library"));
    }

    @DeleteMapping("/files")
    public ResponseEntity<ApiResponse<Void>> deleteMediaFiles(
            @RequestBody List<String> ids,
            @RequestParam(defaultValue = "false") boolean purge) {
        for (String id : ids) {
            mediaInfoService.getById(id).ifPresent(dto -> {
                if (purge) deleteActualFile(dto.getFilePath(), id);
                symlinkService.deleteById(id);
                mediaInfoService.deleteByFilePath(dto.getFilePath());
            });
        }
        return ResponseEntity.ok(ApiResponse.success(
                ids.size() + (purge ? " files permanently deleted" : " files removed from library")));
    }

    @PostMapping("/files/cleanup")
    public ResponseEntity<ApiResponse<Map<String, Object>>> cleanupMediaFiles() {
        List<MediaFileDto> all = mediaInfoService.findAll();
        int removed = 0;
        for (MediaFileDto dto : all) {
            if (dto.getFilePath() != null && !Files.exists(Path.of(dto.getFilePath()))) {
                symlinkService.deleteById(dto.getId());
                mediaInfoService.deleteByFilePath(dto.getFilePath());
                removed++;
            }
        }
        return ResponseEntity.ok(ApiResponse.success("Cleanup complete",
                Map.of("total", all.size(), "removed", removed)));
    }

    /* ── Symlinks ────────────────────────────────────────────────────── */

    @PostMapping("/symlinks/repair")
    public ResponseEntity<ApiResponse<ResponsePayloads.SymlinkRepairResult>> repairAllSymlinks(
            @RequestParam(defaultValue = "false") boolean dryRun) {
        log.info("[ADMIN] Bulk symlink repair triggered (dryRun={})", dryRun);
        ResponsePayloads.SymlinkRepairResult result = symlinkService.ensureAll(dryRun);
        return ResponseEntity.ok(ApiResponse.success(
                dryRun ? "Dry-run symlink repair completed" : "Symlink repair completed", result));
    }

    @PostMapping("/symlinks/repair/{fileId}")
    public ResponseEntity<ApiResponse<ResponsePayloads.SymlinkRepairSingleResult>> repairSingleSymlink(
            @PathVariable String fileId,
            @RequestParam(defaultValue = "false") boolean dryRun) {
        log.info("[ADMIN] Single symlink repair triggered for fileId={} (dryRun={})", fileId, dryRun);
        ResponsePayloads.SymlinkRepairSingleResult result = symlinkService.ensureOne(fileId, dryRun);
        return ResponseEntity.ok(ApiResponse.success(
                dryRun ? "Dry-run completed" : "Symlink repair completed", result));
    }

    @PostMapping("/symlinks/rebuild")
    public ResponseEntity<ApiResponse<ResponsePayloads.SymlinkRepairResult>> rebuildAllSymlinks() {
        log.info("[ADMIN] Symlink rebuild triggered");
        ResponsePayloads.SymlinkRepairResult result = symlinkService.ensureAll(false);
        return ResponseEntity.ok(ApiResponse.success("Symlink rebuild completed", result));
    }

    // ─────────────────────────────────────────────────────────────────────

    private void deleteActualFile(String filePath, String id) {
        if (filePath == null || filePath.isBlank()) return;
        try {
            boolean deleted = Files.deleteIfExists(Path.of(filePath));
            log.info("[ADMIN] File {} (id={}) deleted from disk: {}", filePath, id, deleted);
        } catch (Exception e) {
            log.warn("[ADMIN] Could not delete file {} (id={}): {}", filePath, id, e.getMessage());
        }
    }
}
