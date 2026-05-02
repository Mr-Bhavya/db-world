package com.db.dbworld.app.media.ingestion.processing.strategy;

import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.media.ingestion.model.ProcessingResult;
import com.db.dbworld.app.media.ingestion.spi.ProcessingStrategy;
import com.db.dbworld.app.media.ingestion.tracking.ProgressSnapshot;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import com.db.dbworld.core.exception.ProcessExecutionException;
import com.db.dbworld.core.processor.StreamProcessor;
import com.db.dbworld.core.processor.ProcessExecutor;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extracts downloaded archive files (zip, rar, 7z, tar) using 7z.
 * Runs when IngestionRequest.isExtract() == true.
 * Replaces the old MirrorHelper.handleExtraction() logic.
 */
@Log4j2
@Component
@Order(1)
@RequiredArgsConstructor
public class ExtractionProcessingStrategy implements ProcessingStrategy {
    private static final Pattern PERCENT_PATTERN = Pattern.compile("\\b(\\d{1,3})%");

    private final ProcessExecutor processExecutor;
    private final TrackingService trackingService;

    @Override
    public boolean supports(IngestionContext ctx) {
        return ctx.getRequest().isExtract()
                && ctx.getDownload() != null
                && ctx.getDownload().isSuccess()
                && ctx.getDownload().getFilePath() != null;
    }

    @Override
    public ProcessingResult process(IngestionContext ctx) {
        ProcessingResult result = new ProcessingResult();

        Path archivePath = ctx.getDownload().getFilePath();
        Path extractDir = archivePath.getParent().resolve(stripExtension(archivePath.getFileName().toString()));

        ctx.log("EXTRACT", "Extracting: " + archivePath + " → " + extractDir);

        StringBuilder stderrAccumulator = new StringBuilder();

        try {
            Files.createDirectories(extractDir);

            if (!Files.isWritable(extractDir)) {
                throw new IOException("Target directory is not writable: " + extractDir);
            }

            processExecutor.executeExtraction(
                    archivePath.toAbsolutePath().toString(),
                    extractDir.toAbsolutePath().toString(),
                    ctx.getRequest().getExtractPassword(),
                    buildStreamProcessor(ctx, stderrAccumulator),
                    ctx.getCancellationFlag(),
                    Duration.ofHours(2)
            );

            trackingService.updateProgress(ctx.getJobId(), new ProgressSnapshot(100, 100, 0.0, 0));
            ctx.log("EXTRACT", "Extraction complete → " + extractDir);

            result.setFinalFile(extractDir);
            result.setSuccess(true);

        } catch (ProcessExecutionException e) {
            String detail = stderrAccumulator.length() > 0 ? " | 7z: " + stderrAccumulator.toString().trim() : "";
            String message = "Extraction failed: " + e.getMessage() + detail;
            log.error("[{}] {}", ctx.getJobId(), message);
            ctx.logError("EXTRACT", message);
            result.setSuccess(false);
            result.setErrorMessage(message);

        } catch (IOException e) {
            log.error("[{}] IO error during extraction: {}", ctx.getJobId(), e.getMessage());
            ctx.logError("EXTRACT", "IO error: " + e.getMessage());
            result.setSuccess(false);
            result.setErrorMessage("IO error during extraction: " + e.getMessage());
        }

        return result;
    }

    private StreamProcessor buildStreamProcessor(IngestionContext ctx, StringBuilder stderrAccumulator) {
        long startedAt = System.currentTimeMillis();
        return new StreamProcessor() {
            @Override
            protected void processLine(String line, boolean isErrorStream) {
                if (line == null || line.isBlank()) return;
                String trimmed = line.trim();
                Matcher matcher = PERCENT_PATTERN.matcher(trimmed);
                if (matcher.find()) {
                    int percent = Math.min(100, Integer.parseInt(matcher.group(1)));
                    long eta = estimateEtaSeconds(startedAt, percent);
                    trackingService.updateProgress(ctx.getJobId(), new ProgressSnapshot(percent, 100, 0.0, eta));
                    ctx.log("EXTRACT", trimmed);
                    return;
                }

                if (isErrorStream) {
                    stderrAccumulator.append(trimmed).append('\n');
                    ctx.logError("7Z_ERR", trimmed);
                    return;
                }
                ctx.log("7Z", trimmed);
            }
        };
    }

    private long estimateEtaSeconds(long startedAt, int percent) {
        if (percent <= 0 || percent >= 100) {
            return 0;
        }
        long elapsedMs = Math.max(1L, System.currentTimeMillis() - startedAt);
        long estimatedTotalMs = (elapsedMs * 100L) / percent;
        return Math.max(0L, (estimatedTotalMs - elapsedMs) / 1000L);
    }

    private String stripExtension(String fileName) {
        if (fileName == null) return "extracted";
        int dot = fileName.lastIndexOf('.');
        if (dot > 0) return fileName.substring(0, dot);
        return fileName;
    }
}
