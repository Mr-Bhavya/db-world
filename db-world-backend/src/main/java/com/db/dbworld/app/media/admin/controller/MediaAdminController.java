package com.db.dbworld.app.media.admin.controller;

import com.db.dbworld.app.media.delete.MediaFileDeleteResult;
import com.db.dbworld.app.media.delete.MediaFileDeletionService;
import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.db.dbworld.app.media.info.dto.MediaFileStatsDto;
import com.db.dbworld.app.media.info.dto.MediaFileSummaryDto;
import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.app.media.link.SymlinkService;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.ResponsePayloads;
import com.db.dbworld.config.AppConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.domain.Page;
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
@PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
@RequiredArgsConstructor
public class MediaAdminController {

    private final MediaInfoService        mediaInfoService;
    private final SymlinkService          symlinkService;
    private final MediaFileDeletionService deletionService;

    /* â”€â”€ File info â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

    @GetMapping("/files")
    public ResponseEntity<ApiResponse<Page<MediaFileSummaryDto>>> getMediaFilesPaged(
            @RequestParam(defaultValue = "")      String  q,
            @RequestParam(required = false)       Boolean linked,
            @RequestParam(defaultValue = "newest") String  sort,
            @RequestParam(defaultValue = "0")     int     page,
            @RequestParam(defaultValue = "50")    int     size) {
        Page<MediaFileSummaryDto> result = mediaInfoService.getPagedSummary(
                q.isBlank() ? null : q, linked, sort, page, Math.min(size, 200));
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/files/stats")
    public ResponseEntity<ApiResponse<MediaFileStatsDto>> getMediaFileStats() {
        return ResponseEntity.ok(ApiResponse.success(mediaInfoService.getStats()));
    }

    @GetMapping("/files/{id}")
    public ResponseEntity<ApiResponse<MediaFileDto>> getMediaFileById(@PathVariable String id) {
        return mediaInfoService.getById(id)
                .map(dto -> ResponseEntity.ok(ApiResponse.success(dto)))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error(404, "MediaFile not found: " + id, (MediaFileDto) null)));
    }

    @DeleteMapping("/files/{id}")
    public ResponseEntity<ApiResponse<MediaFileDeleteResult>> deleteMediaFile(
            @PathVariable String id,
            @RequestParam(defaultValue = "false") boolean purge) {
        MediaFileDeleteResult result = deletionService.deleteById(id, purge);
        return ResponseEntity.ok(ApiResponse.success(deleteMessage(result, purge), result));
    }

    @DeleteMapping("/files")
    public ResponseEntity<ApiResponse<List<MediaFileDeleteResult>>> deleteMediaFiles(
            @RequestBody List<String> ids,
            @RequestParam(defaultValue = "false") boolean purge) {
        List<MediaFileDeleteResult> results = ids.stream()
                .map(id -> deletionService.deleteById(id, purge))
                .toList();
        long withWarnings = results.stream().filter(r -> !r.clean()).count();
        String verb = purge ? "permanently deleted" : "removed from library";
        String msg  = withWarnings == 0
                ? ids.size() + " file(s) " + verb
                : ids.size() + " file(s) " + verb + " (" + withWarnings + " with warnings — check logs)";
        return ResponseEntity.ok(ApiResponse.success(msg, results));
    }

    /** Honest one-line summary for a single delete: reflects any partial failure. */
    private String deleteMessage(MediaFileDeleteResult r, boolean purge) {
        if (!r.found())  return "Media file not found";
        if (r.clean())   return purge ? "Permanently deleted" : "Removed from library";
        return "Deleted with warnings: " + String.join("; ", r.warnings());
    }

    @PatchMapping("/files/{id}/episode")
    public ResponseEntity<ApiResponse<MediaFileDto>> setEpisodeNumbers(
            @PathVariable String id,
            @RequestParam(required = false) Integer season,
            @RequestParam(required = false) Integer episode) {
        return ResponseEntity.ok(ApiResponse.success(mediaInfoService.updateEpisodeNumbers(id, season, episode)));
    }

    /** (Re)generate the scrub-preview storyboard sprite for a single file. Runs async. */
    @PostMapping("/files/{id}/storyboard")
    public ResponseEntity<ApiResponse<Void>> generateStoryboard(@PathVariable String id) {
        try {
            mediaInfoService.generateStoryboard(id);
            return ResponseEntity.accepted()
                    .body(ApiResponse.success("Storyboard generation started"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(404, e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(400, e.getMessage()));
        }
    }

    @PostMapping("/files/cleanup")
    public ResponseEntity<ApiResponse<Map<String, Object>>> cleanupMediaFiles() {
        List<MediaFileDto> all = mediaInfoService.findAll();
        int removed = 0;
        for (MediaFileDto dto : all) {
            if (dto.getFilePath() != null && !Files.exists(Path.of(dto.getFilePath()))) {
                // File already gone → keep-file mode; this also clears the symlink + storyboard.
                deletionService.deleteById(dto.getId(), false);
                removed++;
            }
        }
        return ResponseEntity.ok(ApiResponse.success("Cleanup complete",
                Map.of("total", all.size(), "removed", removed)));
    }

    /* â”€â”€ Symlinks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

}
