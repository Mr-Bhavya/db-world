package com.db.dbworld.app.media.ingestion.migration;

import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.apache.logging.log4j.ThreadContext;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;

/**
 * One-time migration: scans the stream-path directory for media files that
 * have no corresponding DB entry, and creates one for each using MediaInfoService
 * (with recordId = null â€” files can be linked later via the admin UI).
 *
 * Trigger via POST /api/ingestion/migrate/scan-stream (admin-only).
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class StreamMigrationService {

    private static final Set<String> MEDIA_EXTENSIONS = Set.of(
            "mkv", "mp4", "avi", "mov", "ts", "m2ts", "m4v", "wmv", "flv", "webm", "mpg", "mpeg"
    );

    private final MediaInfoService         mediaInfoService;
    private final AppProperties runtimeProperties;

    public MigrationReport scanAndLink() throws IOException {
        ThreadContext.put("traceId", "migration-" + UUID.randomUUID());
        try {
        log.debug("scanAndLink invoked");
        Path streamRoot = runtimeProperties.getStreamPath();
        if (streamRoot == null) {
            log.error("scanAndLink aborted — db-world.stream-path missing");
            throw new IllegalStateException("Stream path is not configured (db-world.stream-path is missing)");
        }
        if (!Files.isDirectory(streamRoot)) {
            log.error("scanAndLink aborted — stream path is not a directory: {}", streamRoot);
            throw new IllegalStateException("Stream path is not a directory: " + streamRoot);
        }

        log.info("Starting stream migration scan in {}", streamRoot);
        int scanned = 0, alreadyPresent = 0, created = 0, failed = 0;
        List<String> failedFiles = new ArrayList<>();

        try (var walker = Files.walk(streamRoot)) {
            Iterable<Path> files = () -> walker
                    .filter(Files::isRegularFile)
                    .filter(p -> {
                        String name = p.getFileName().toString().toLowerCase();
                        int dot = name.lastIndexOf('.');
                        return dot > 0 && MEDIA_EXTENSIONS.contains(name.substring(dot + 1));
                    })
                    .iterator();

            for (Path file : files) {
                scanned++;
                String absolutePath = file.toAbsolutePath().toString();

                if (mediaInfoService.getByFilePath(absolutePath).isPresent()) {
                    alreadyPresent++;
                    log.debug("Already present: {}", file.getFileName());
                    continue;
                }

                try {
                    mediaInfoService.collectAndPersist(file, null, "MIGRATION");
                    created++;
                    log.info("Migrated: {}", file.getFileName());
                } catch (Exception e) {
                    failed++;
                    failedFiles.add(file.getFileName().toString() + ": " + e.getMessage());
                    log.warn("Migration failed for {}: {}", file.getFileName(), e.getMessage(), e);
                }
            }
        }

        log.info("Migration complete — scanned={}, alreadyPresent={}, created={}, failed={}",
                scanned, alreadyPresent, created, failed);
        return new MigrationReport(scanned, alreadyPresent, created, failed, failedFiles);
        } finally {
            ThreadContext.clearAll();
        }
    }

    public record MigrationReport(
            int scanned,
            int alreadyPresent,
            int created,
            int failed,
            List<String> failedFiles
    ) {}
}
