package com.db.dbworld.app.media.ingestion.processing.fs;

import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.utils.PathSanitizer;
import com.db.dbworld.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.file.Path;

/**
 * Default file storage implementation.
 * Uses AppProperties to resolve base paths from application.yml
 * instead of hardcoded strings.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class DefaultFileStorageService implements FileStorageService {

    private final AppProperties runtimeProperties;
    private final RecordRepository         recordRepository;

    @Override
    public Path resolveTempDir(IngestionContext ctx) {
        return runtimeProperties.getTempPath().resolve(safeFolderName(ctx));
    }

    @Override
    public Path resolveFinalDir(IngestionContext ctx) {
        Long recordId = ctx.getRecordId() != null
                ? ctx.getRecordId()
                : (ctx.getRequest() != null ? ctx.getRequest().getRecordId() : null);

        String recordTypePath = resolveRecordType(recordId);
        String folder = safeFolderName(ctx);
        Path base = runtimeProperties.getStreamPath().resolve(recordTypePath);
        // Only nest a folder segment when it adds information. For an unassigned file with no
        // explicit folder name both would be "unassigned", producing .../unassigned/unassigned/.
        if (!recordTypePath.equals(folder)) {
            base = base.resolve(folder);
        }

        // For TV series, create a season subfolder (S01, S02, â€¦)
        if ("TV_SERIES".equals(recordTypePath)) {
            Integer season = ctx.getRequest() != null ? ctx.getRequest().getSeason() : null;
            if (season != null) {
                base = base.resolve(String.format("S%02d", season));
            }
        }
        return base;
    }

    private String resolveRecordType(Long recordId) {
        if (recordId == null) return "unassigned";
        return recordRepository.findById(recordId)
                .map(r -> r.getType().name())   // "MOVIE" or "TV_SERIES"
                .orElse("unassigned");
    }

    @Override
    public Path resolveTempFile(IngestionContext ctx) {
        String fileName = safeFileName(ctx);
        return resolveTempDir(ctx).resolve(fileName);
    }

    @Override
    public Path resolveFinalFile(IngestionContext ctx) {
        String fileName = safeFileName(ctx);
        return resolveFinalDir(ctx).resolve(fileName);
    }

    @Override
    public void prepareDirectories(IngestionContext ctx) {
        try {
            java.nio.file.Files.createDirectories(resolveTempDir(ctx));
            java.nio.file.Files.createDirectories(resolveFinalDir(ctx));
            log.debug("[{}] Directories prepared: temp={}, final={}",
                    ctx.getJobId(), resolveTempDir(ctx), resolveFinalDir(ctx));
        } catch (Exception e) {
            throw new RuntimeException("Failed to prepare directories for job: " + ctx.getJobId(), e);
        }
    }

    @Override
    public void moveToFinal(IngestionContext ctx) {
        try {
            Path src = resolveTempFile(ctx);
            Path dst = resolveFinalFile(ctx);
            java.nio.file.Files.createDirectories(dst.getParent());
            java.nio.file.Files.move(src, dst, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            log.debug("[{}] Moved: {} â†’ {}", ctx.getJobId(), src, dst);
        } catch (Exception e) {
            throw new RuntimeException("Move to final failed for job: " + ctx.getJobId(), e);
        }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private String safeFolderName(IngestionContext ctx) {
        String folder = ctx.getRequest() != null ? ctx.getRequest().getFolderName() : null;
        if (StringUtils.hasText(folder)) {
            return PathSanitizer.sanitizePathComponent(folder);
        }

        Long recordId = ctx.getRecordId() != null
                ? ctx.getRecordId()
                : (ctx.getRequest() != null ? ctx.getRequest().getRecordId() : null);

        if (recordId != null) {
            String derived = recordRepository.findById(recordId)
                    .map(record -> recordId + "-" + PathSanitizer.sanitizePathComponent(record.getName()))
                    .orElse(String.valueOf(recordId));
            if (ctx.getRequest() != null) {
                ctx.getRequest().setFolderName(derived);
            }
            return derived;
        }

        return "unassigned";
    }

    private String safeFileName(IngestionContext ctx) {
        String name = ctx.getRequest() != null ? ctx.getRequest().getFileName() : null;
        if (!StringUtils.hasText(name) && ctx.getDownload() != null) {
            name = ctx.getDownload().getFileName();
        }
        return StringUtils.hasText(name) ? name : ctx.getJobId();
    }
}
