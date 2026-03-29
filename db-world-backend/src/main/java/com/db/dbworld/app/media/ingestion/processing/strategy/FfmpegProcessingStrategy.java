package com.db.dbworld.app.media.ingestion.processing.strategy;

import com.db.dbworld.app.media.enrichment.TmdbMediaEnrichmentService;
import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.media.ingestion.model.ProcessingResult;
import com.db.dbworld.app.media.ingestion.processing.fs.FileStorageService;
import com.db.dbworld.app.media.ingestion.spi.ProcessingStrategy;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;

/**
 * Moves the downloaded file from temp to the final directory, then:
 *  1. Embeds TMDB cover art (poster / episode still) via FFmpeg
 *  2. Renames the file for TV series: {Title}.S{SS}E{EE}.{EpisodeName}.{ext}
 *  3. Sets FFmpeg metadata title (episode name for series, movie title for films)
 *  4. Collects and persists MediaInfo metadata via MediaInfoService
 *
 * Order = 10 → runs after ExtractionProcessingStrategy (Order = 1).
 */
@Log4j2
@Component
@Order(10)
@RequiredArgsConstructor
public class FfmpegProcessingStrategy implements ProcessingStrategy {

    private final FileStorageService         fileStorageService;
    private final MediaInfoService           mediaInfoService;
    private final TmdbMediaEnrichmentService enrichmentService;

    @Override
    public boolean supports(IngestionContext ctx) {
        if (ctx.getDownload() == null || !ctx.getDownload().isSuccess()) return false;
        // Skip if extraction succeeded — extraction already owns the final file
        if (ctx.getRequest().isExtract()
                && ctx.getProcessing() != null
                && ctx.getProcessing().isSuccess()) {
            return false;
        }
        return true;
    }

    @Override
    public ProcessingResult process(IngestionContext ctx) {
        ProcessingResult result = new ProcessingResult();

        try {
            Path tempFile = ctx.getDownload().getFilePath();

            if (tempFile == null || !Files.exists(tempFile)) {
                result.setSuccess(false);
                result.setErrorMessage("Downloaded temp file not found: " + tempFile);
                return result;
            }

            // ── 1. Move to final directory ─────────────────────────────────
            Path finalDir = fileStorageService.resolveFinalDir(ctx);
            Files.createDirectories(finalDir);

            String fileName = ctx.getDownload().getFileName() != null
                    ? ctx.getDownload().getFileName()
                    : tempFile.getFileName().toString();

            Path movedFile = finalDir.resolve(fileName);
            ctx.log("FFMPEG", "Moving: " + tempFile.getFileName() + " → " + finalDir);
            Files.move(tempFile, movedFile, StandardCopyOption.REPLACE_EXISTING);
            ctx.log("FFMPEG", "Move complete");

            // ── 2. TMDB enrichment: cover art + series naming + metadata ───
            Path finalFile = enrichWithTmdb(ctx, movedFile);

            // ── 3. Collect and persist MediaInfo ───────────────────────────
            Map<String, Object> mediaInfoResult = collectMediaInfo(ctx, finalFile);

            result.setFinalFile(finalFile);
            result.setSuccess(true);
            result.setMediaInfo(mediaInfoResult);

        } catch (IOException e) {
            log.error("[{}] FfmpegProcessingStrategy failed: {}", ctx.getJobId(), e.getMessage());
            ctx.logError("FFMPEG", "Failed: " + e.getMessage());
            result.setSuccess(false);
            result.setErrorMessage(e.getMessage());
        }

        return result;
    }

    // ──────────────────────────────────────────────────────────────────────────

    private Path enrichWithTmdb(IngestionContext ctx, Path movedFile) {
        try {
            Path enriched = enrichmentService.enrich(
                    movedFile,
                    ctx.getRecordId(),
                    ctx.getRequest().getSeason(),
                    ctx.getRequest().getEpisode(),
                    ctx.getRequest().getTrackFilter(),
                    ctx.getJobId()
            );
            if (!enriched.equals(movedFile)) {
                ctx.log("FFMPEG", "Enriched → " + enriched.getFileName());
            }
            return enriched;
        } catch (Exception e) {
            ctx.logError("FFMPEG", "Enrichment failed (non-fatal): " + e.getMessage());
            return movedFile; // continue with un-enriched file
        }
    }

    private Map<String, Object> collectMediaInfo(IngestionContext ctx, Path finalFile) {
        try {
            MediaFileDto dto = mediaInfoService.collectAndPersist(
                    finalFile,
                    ctx.getRecordId(),
                    ctx.getJobId()
            );
            ctx.log("MEDIA_INFO", "Persisted: id=" + dto.getId()
                    + ", tracks=" + (dto.getTracks() != null ? dto.getTracks().size() : 0));

            return Map.of(
                    "mediaFileId", dto.getId(),
                    "fileName",    dto.getFileName() != null ? dto.getFileName() : ""
            );
        } catch (Exception e) {
            ctx.logError("MEDIA_INFO", "MediaInfo failed (non-fatal): " + e.getMessage());
            return null;
        }
    }
}
