//package com.db.dbworld.services.media;
//
//import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
//import com.db.dbworld.core.exception.DbWorldException;
//import com.db.dbworld.payloads.ResponsePayloads;
//import com.db.dbworld.utils.DbWorldRuntimeProperties;
//import lombok.extern.log4j.Log4j2;
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.stereotype.Service;
//
//import java.nio.file.Files;
//import java.nio.file.LinkOption;
//import java.nio.file.Path;
//import java.util.HashSet;
//import java.util.List;
//import java.util.Set;
//import java.util.concurrent.atomic.AtomicInteger;
//import java.util.stream.Stream;
//
//@Log4j2
//@Service
//public class SystemLinkService {
//
//    private final DbWorldRuntimeProperties runtimeProperties;
//    private final MediaFileInfoService mediaFileInfoService;
//
//    @Autowired
//    public SystemLinkService(
//            DbWorldRuntimeProperties runtimeProperties,
//            MediaFileInfoService mediaFileInfoService) {
//        this.runtimeProperties = runtimeProperties;
//        this.mediaFileInfoService = mediaFileInfoService;
//    }
//
//    /* =========================================================
//       CREATE
//       ========================================================= */
//
//    public void create(MediaFileInfoEntity entity) {
//        if (entity == null || entity.getId() == null || entity.getFilePath() == null) {
//            throw new DbWorldException("Invalid media entity for symlink creation");
//        }
//
//        try {
//            Path symlinkRoot = runtimeProperties.getSymlinkPath();
//            Path realFile = Path.of(entity.getFilePath());
//            Path symlink = symlinkRoot.resolve(entity.getId());
//
//            Files.createDirectories(symlinkRoot);
//
//            if (Files.exists(symlink, LinkOption.NOFOLLOW_LINKS)) {
//                Files.delete(symlink);
//            }
//
//            Path relativeTarget = symlinkRoot.relativize(realFile);
//            Files.createSymbolicLink(symlink, relativeTarget);
//
//            log.debug("[SYMLINK] Created {} -> {}", symlink, relativeTarget);
//
//        } catch (Exception ex) {
//            log.error("[SYMLINK] Failed to create symlink for fileId={}", entity.getId(), ex);
//            throw new DbWorldException("Failed to create system symlink", ex);
//        }
//    }
//
//    /* =========================================================
//       DELETE
//       ========================================================= */
//
//    public void deleteById(String fileId) {
//        try {
//            Path symlink = runtimeProperties.getSymlinkPath().resolve(fileId);
//
//            if (Files.exists(symlink, LinkOption.NOFOLLOW_LINKS)) {
//                Files.delete(symlink);
//                log.info("[SYMLINK] Deleted symlink {}", symlink);
//            }
//
//        } catch (Exception ex) {
//            log.warn("[SYMLINK] Failed to delete symlink for fileId={}", fileId, ex);
//        }
//    }
//
//    /* =========================================================
//       VALIDATION
//       ========================================================= */
//
//    public boolean isValid(String fileId) {
//        try {
//            Path symlink = runtimeProperties.getSymlinkPath().resolve(fileId);
//            return Files.exists(symlink, LinkOption.NOFOLLOW_LINKS)
//                    && Files.exists(symlink.toRealPath());
//        } catch (Exception ex) {
//            return false;
//        }
//    }
//
//    public boolean ensure(MediaFileInfoEntity entity) {
//        if (!isValid(entity.getId())) {
//            create(entity);
//            return true;
//        }
//        return false;
//    }
//
//    /* =========================================================
//       SINGLE ID REPAIR
//       ========================================================= */
//
//    public ResponsePayloads.SymlinkRepairSingleResult ensureOne(
//            String fileId,
//            boolean dryRun) {
//
//        try {
//            Path symlink = runtimeProperties.getSymlinkPath().resolve(fileId);
//
//            MediaFileInfoEntity entity = mediaFileInfoService.findEntityById(fileId)
//                    .orElse(null);
//
//            // ---- DB exists → create / repair
//            if (entity != null && entity.getFilePath() != null) {
//
//                if (isValid(fileId)) {
//                    return ResponsePayloads.SymlinkRepairSingleResult.builder()
//                            .fileId(fileId)
//                            .skipped(true)
//                            .message("Symlink already valid")
//                            .build();
//                }
//
//                if (!dryRun) {
//                    create(entity);
//                }
//
//                return ResponsePayloads.SymlinkRepairSingleResult.builder()
//                        .fileId(fileId)
//                        .created(true)
//                        .message(dryRun
//                                ? "Symlink would be created"
//                                : "Symlink created")
//                        .build();
//            }
//
//            // ---- Orphan symlink → delete
//            if (Files.exists(symlink, LinkOption.NOFOLLOW_LINKS)) {
//
//                if (!dryRun) {
//                    Files.delete(symlink);
//                }
//
//                return ResponsePayloads.SymlinkRepairSingleResult.builder()
//                        .fileId(fileId)
//                        .deleted(true)
//                        .message(dryRun
//                                ? "Orphan symlink would be deleted"
//                                : "Orphan symlink deleted")
//                        .build();
//            }
//
//            return ResponsePayloads.SymlinkRepairSingleResult.builder()
//                    .fileId(fileId)
//                    .skipped(true)
//                    .message("Nothing to repair")
//                    .build();
//
//        } catch (Exception ex) {
//            log.warn("[SYMLINK] Single repair failed for fileId={}", fileId, ex);
//
//            return ResponsePayloads.SymlinkRepairSingleResult.builder()
//                    .fileId(fileId)
//                    .failed(true)
//                    .message("Repair failed: " + ex.getMessage())
//                    .build();
//        }
//    }
//
//    /* =========================================================
//       BULK REPAIR (API SUPPORT)
//       ========================================================= */
//
//    public ResponsePayloads.SymlinkRepairResult ensureAll(boolean dryRun) {
//
//        int repaired = 0;
//        int skipped = 0;
//        AtomicInteger deleted = new AtomicInteger();
//        AtomicInteger failed = new AtomicInteger();
//
//        Path symlinkRoot = runtimeProperties.getSymlinkPath();
//        List<MediaFileInfoEntity> entities = mediaFileInfoService.findAllEntities();
//
//        // ---- Collect DB IDs
//        Set<String> dbIds = new HashSet<>();
//        for (MediaFileInfoEntity entity : entities) {
//            if (entity != null && entity.getId() != null) {
//                dbIds.add(entity.getId());
//            }
//        }
//
//        // ---- DB → SYMLINK
//        for (MediaFileInfoEntity entity : entities) {
//            try {
//                if (entity == null || entity.getId() == null || entity.getFilePath() == null) {
//                    skipped++;
//                    continue;
//                }
//
//                if (!isValid(entity.getId())) {
//                    if (!dryRun) {
//                        create(entity);
//                    }
//                    repaired++;
//                }
//
//            } catch (Exception ex) {
//                failed.incrementAndGet();
//                log.warn("[SYMLINK] Repair failed for fileId={}", entity.getId(), ex);
//            }
//        }
//
//        // ---- SYMLINK → DB (cleanup orphans)
//        if (Files.exists(symlinkRoot)) {
//            try (Stream<Path> paths = Files.list(symlinkRoot)) {
//                paths.forEach(path -> {
//                    try {
//                        String fileId = path.getFileName().toString();
//
//                        if (Files.isSymbolicLink(path) && !dbIds.contains(fileId)) {
//                            if (!dryRun) {
//                                Files.delete(path);
//                            }
//                            deleted.incrementAndGet();
//                            log.info("[SYMLINK] Removed orphan symlink {}", path);
//                        }
//
//                    } catch (Exception ex) {
//                        failed.incrementAndGet();
//                        log.warn("[SYMLINK] Failed to cleanup symlink {}", path, ex);
//                    }
//                });
//            } catch (Exception ex) {
//                log.error("[SYMLINK] Failed to scan symlink directory", ex);
//            }
//        }
//
//        return ResponsePayloads.SymlinkRepairResult.builder()
//                .total(entities.size())
//                .repaired(repaired)
//                .deleted(deleted.get())
//                .skipped(skipped)
//                .failed(failed.get())
//                .dryRun(dryRun)
//                .build();
//    }
//}
