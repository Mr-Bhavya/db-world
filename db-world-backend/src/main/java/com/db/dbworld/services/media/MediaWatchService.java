//package com.db.dbworld.services.media;
//
//import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
//import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
//import com.db.dbworld.services.cinema.DBCinemaRecordsService;
//import com.db.dbworld.utils.FileIdentityUtils;
//import com.db.dbworld.utils.RecordPathResolver;
//import lombok.Setter;
//import lombok.extern.log4j.Log4j2;
//import org.springframework.messaging.Message;
//import org.springframework.messaging.MessageHeaders;
//import org.springframework.stereotype.Service;
//
//import java.io.File;
//import java.nio.file.Files;
//import java.nio.file.Path;
//import java.util.List;
//import java.util.Objects;
//import java.util.Optional;
//
///**
// * @deprecated Superseded by {@link com.db.dbworld.app.media.watch.FileWatcherService}
// * which uses the new MediaInfoService + SymlinkService pipeline.
// */
//@Deprecated(forRemoval = true)
//@Log4j2
//@Service
//public class MediaWatchService {
//
//    private final MediaFileInfoService mediaService;
//    private final DBCinemaRecordsService recordsService;
//    private final SystemLinkService systemLinkService;
//
//    @Setter
//    private volatile boolean dryRun = true;
//
//    public MediaWatchService(
//            MediaFileInfoService mediaService,
//            DBCinemaRecordsService recordsService,
//            SystemLinkService systemLinkService
//    ) {
//        this.mediaService = mediaService;
//        this.recordsService = recordsService;
//        this.systemLinkService = systemLinkService;
//    }
//
//    /* =========================================================
//       ENTRY POINT (SPRING INTEGRATION)
//       ========================================================= */
//
//    public void process(Message<File> message) {
//
//        File file = message.getPayload();
//        Path path = file.toPath();
//
//        if (Files.exists(path)) {
//            handleCreateOrModify(message);
//        } else {
//            handleDelete(message);
//        }
//    }
//
//    /* =========================================================
//       CREATE / MODIFY
//       ========================================================= */
//
//    public void handleCreateOrModify(Message<File> message) {
//        Path file = message.getPayload().toPath();
//        MessageHeaders headers = message.getHeaders();
//        headers.forEach((key, value) -> log.info("[Method: handleCreateOrModify] Key: {} - Value: {}", key, value));
//        try {
//            if (!Files.isRegularFile(file)) return;
//            if (!FileIdentityUtils.isStable(file, 5)) return;
//
//            Optional<DBCinemaRecordsEntity> recordOpt =
//                    RecordPathResolver.resolveRecord(file, recordsService::getRecordEntityOptById);
//
//            if (recordOpt.isEmpty()) return;
//
//            DBCinemaRecordsEntity record = recordOpt.get();
//            long size = Files.size(file);
//            String partialHash = FileIdentityUtils.partialHash(file);
//
//            List<MediaFileInfoEntity> existing =
//                    mediaService.findAllEntities().stream()
//                            .filter(e -> e.getDbCinemaRecord().getId().equals(record.getId()))
//                            .toList();
//
//            // Exact path already exists
//            for (MediaFileInfoEntity e : existing) {
//                if (file.toString().equals(e.getFilePath())) return;
//            }
//
//            // Move / rename detection
//            for (MediaFileInfoEntity e : existing) {
//                if (Objects.equals(e.getFileSize(), size)) {
//                    String existingHash =
//                            FileIdentityUtils.partialHash(Path.of(e.getFilePath()));
//
//                    if (Objects.equals(partialHash, existingHash)) {
//                        log.info("[WATCH] Move/Rename detected: {} → {}", e.getFilePath(), file);
//
//                        if (!dryRun) {
//                            e.setFilePath(file.toString());
//                            e.initialize(record);
//                            mediaService.save(e);
//                            systemLinkService.ensure(e);
//                        }
//                        return;
//                    }
//                }
//            }
//
//            // New file
//            log.info("[WATCH] New file detected: {}", file);
//
//            if (!dryRun) {
//                MediaFileInfoEntity entity = new MediaFileInfoEntity();
//                entity.setFilePath(file.toString());
//                entity.setFileSize(size);
//                entity.initialize(record);
//                mediaService.save(entity);
//                systemLinkService.ensure(entity);
//            }
//
//        } catch (Exception ex) {
//            log.warn("[WATCH] Failed processing {}", file, ex);
//        }
//    }
//
//    /* =========================================================
//       DELETE
//       ========================================================= */
//
//    public void handleDelete(Message<File> message) {
//
//        Path file = message.getPayload().toPath();
//        MessageHeaders headers = message.getHeaders();
//        headers.forEach((key, value) -> log.info("[Method: handleDelete] Key: {} - Value: {}", key, value));
//        mediaService.findAllEntities().stream()
//                .filter(e -> file.toString().equals(e.getFilePath()))
//                .findFirst()
//                .ifPresent(e -> {
//                    log.warn("[WATCH] File deleted: {}", file);
//
//                    if (!dryRun) {
//                        mediaService.deleteInfoById(e.getId());
//                        systemLinkService.deleteById(e.getId());
//                    }
//                });
//    }
//}
