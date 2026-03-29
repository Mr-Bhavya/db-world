//package com.db.dbworld.controllers;
//
//import com.db.dbworld.payloads.ApiResponse;
//import com.db.dbworld.payloads.ResponsePayloads;
//import com.db.dbworld.payloads.dbcinema.stream.MediaFileInfo;
//import com.db.dbworld.utils.DbWorldConstants;
//import lombok.extern.log4j.Log4j2;
//import org.springframework.http.HttpStatus;
//import org.springframework.http.ResponseEntity;
//import org.springframework.security.access.prepost.PreAuthorize;
//import org.springframework.web.bind.annotation.*;
//
//import java.util.List;
//import java.util.Map;
//
//@Log4j2
//@RestController
//@RequestMapping("/api/admin/media")
//@PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
//public class MediaAdminController {
//
//    private final MediaFileInfoService mediaFileInfoService;
//    private final SystemLinkService systemLinkService;
//
//    public MediaAdminController(MediaFileInfoService mediaFileInfoService, SystemLinkService systemLinkService) {
//        this.mediaFileInfoService = mediaFileInfoService;
//        this.systemLinkService = systemLinkService;
//    }
//
//    /* =========================================================
//       MEDIA FILE INFO (DB)
//       ========================================================= */
//
//    @GetMapping("/files")
//    public ResponseEntity<ApiResponse<List<MediaFileInfo>>> getAllMediaFiles() {
//        List<MediaFileInfo> list = mediaFileInfoService.findAll();
//        return ResponseEntity.ok(ApiResponse.success(list));
//    }
//
//    @GetMapping("/files/{id}")
//    public ResponseEntity<ApiResponse<MediaFileInfo>> getMediaFileById(@PathVariable String id) {
//        MediaFileInfo entity = mediaFileInfoService.findById(id).orElseThrow();
//        return ResponseEntity.ok(ApiResponse.success(entity));
//    }
//
//    @DeleteMapping("/files/{id}")
//    public ResponseEntity<ApiResponse<Void>> deleteMediaFile(@PathVariable String id) {
//        mediaFileInfoService.deleteInfoById(id);
//        return ResponseEntity.ok(ApiResponse.success("Media file deleted successfully"));
//    }
//
//    @DeleteMapping("/files")
//    public ResponseEntity<ApiResponse<Void>> deleteMediaFiles(@RequestBody List<String> ids) {
//        mediaFileInfoService.deleteInfoByIds(ids);
//        return ResponseEntity.ok(ApiResponse.success("Media files deleted successfully"));
//    }
//
//    @PostMapping("/files/cleanup")
//    public ResponseEntity<ApiResponse<Map<String, Integer>>> cleanupMediaFiles() {
//        Map<String, Integer> result = mediaFileInfoService.cleanMediaFileInfo();
//        return ResponseEntity.ok(ApiResponse.success("Media cleanup completed", result));
//    }
//
//    /* =========================================================
//       SYSTEM LINK (FILESYSTEM)
//       ========================================================= */
//
//    @PostMapping("/symlinks/repair")
//    public ResponseEntity<ApiResponse<ResponsePayloads.SymlinkRepairResult>> repairAllSymlinks(
//            @RequestParam(defaultValue = "false") boolean dryRun) {
//
//        log.info("[ADMIN] Bulk symlink repair triggered (dryRun={})", dryRun);
//        ResponsePayloads.SymlinkRepairResult result = systemLinkService.ensureAll(dryRun);
//
//        return ResponseEntity.ok(
//                ApiResponse.success(
//                        dryRun ? "Dry-run symlink repair completed" : "Symlink repair completed",
//                        result
//                )
//        );
//    }
//
//    @PostMapping("/symlinks/repair/{fileId}")
//    public ResponseEntity<ApiResponse<ResponsePayloads.SymlinkRepairSingleResult>> repairSingleSymlink(
//            @PathVariable String fileId,
//            @RequestParam(defaultValue = "false") boolean dryRun) {
//
//        log.info("[ADMIN] Single symlink repair triggered for fileId={} (dryRun={})", fileId, dryRun);
//        ResponsePayloads.SymlinkRepairSingleResult result = systemLinkService.ensureOne(fileId, dryRun);
//
//        return ResponseEntity.ok(
//                ApiResponse.success(
//                        dryRun ? "Dry-run symlink repair completed" : "Symlink repair completed",
//                        result
//                )
//        );
//    }
//
//    @PostMapping("/symlinks/rebuild")
//    public ResponseEntity<ApiResponse<Void>> rebuildAllSymlinks() {
////        mediaFileInfoService.rebuildAllSymlinks();
//        return ResponseEntity.status(HttpStatus.ACCEPTED)
//                .body(ApiResponse.success("Symlink rebuild triggered"));
//    }
//}
