package com.db.dbworld.app.media.ingestion.processing.fs;

import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.utils.DbWorldRuntimeProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.file.Path;

/**
 * Default file storage implementation.
 * Uses DbWorldRuntimeProperties to resolve base paths from application.yml
 * instead of hardcoded strings.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class DefaultFileStorageService implements FileStorageService {

    private final DbWorldRuntimeProperties runtimeProperties;

    @Override
    public Path resolveTempDir(IngestionContext ctx) {
        return runtimeProperties.getTempPath().resolve(safeFolderName(ctx));
    }

    @Override
    public Path resolveFinalDir(IngestionContext ctx) {
        return runtimeProperties.getStreamPath().resolve(safeFolderName(ctx));
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
            log.debug("[{}] Moved: {} → {}", ctx.getJobId(), src, dst);
        } catch (Exception e) {
            throw new RuntimeException("Move to final failed for job: " + ctx.getJobId(), e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    private String safeFolderName(IngestionContext ctx) {
        String folder = ctx.getRequest() != null ? ctx.getRequest().getFolderName() : null;
        return StringUtils.hasText(folder) ? folder : "unassigned";
    }

    private String safeFileName(IngestionContext ctx) {
        String name = ctx.getRequest() != null ? ctx.getRequest().getFileName() : null;
        if (!StringUtils.hasText(name) && ctx.getDownload() != null) {
            name = ctx.getDownload().getFileName();
        }
        return StringUtils.hasText(name) ? name : ctx.getJobId();
    }
}
