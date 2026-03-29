package com.db.dbworld.app.media.ingestion.processing.strategy;

import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.media.ingestion.model.ProcessingResult;
import com.db.dbworld.app.media.ingestion.spi.ProcessingStrategy;
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

    private final ProcessExecutor processExecutor;

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

        try {
            Files.createDirectories(extractDir);

            processExecutor.executeExtraction(
                    archivePath.toAbsolutePath().toString(),
                    extractDir.toAbsolutePath().toString(),
                    buildStreamProcessor(ctx),
                    ctx.getCancellationFlag(),
                    Duration.ofHours(2)
            );

            ctx.log("EXTRACT", "Extraction complete → " + extractDir);

            result.setFinalFile(extractDir);
            result.setSuccess(true);

        } catch (ProcessExecutionException e) {
            log.error("[{}] Extraction failed: {}", ctx.getJobId(), e.getMessage());
            ctx.logError("EXTRACT", "Extraction failed: " + e.getMessage());
            result.setSuccess(false);
            result.setErrorMessage("Extraction failed: " + e.getMessage());

        } catch (IOException e) {
            log.error("[{}] IO error during extraction: {}", ctx.getJobId(), e.getMessage());
            ctx.logError("EXTRACT", "IO error: " + e.getMessage());
            result.setSuccess(false);
            result.setErrorMessage("IO error during extraction: " + e.getMessage());
        }

        return result;
    }

    private StreamProcessor buildStreamProcessor(IngestionContext ctx) {
        return new StreamProcessor() {
            @Override
            protected void processLine(String line, boolean isErrorStream) {
                if (line == null || line.isBlank()) return;
                if (isErrorStream) {
                    ctx.logError("7Z_ERR", line);
                } else {
                    ctx.log("7Z", line);
                }
            }
        };
    }

    private String stripExtension(String fileName) {
        if (fileName == null) return "extracted";
        int dot = fileName.lastIndexOf('.');
        if (dot > 0) return fileName.substring(0, dot);
        return fileName;
    }
}
