package com.db.dbworld.helpers;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.ExtractException;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.mirror.StatusService;
import com.db.dbworld.stream.processor.GenericStreamProcessor;
import com.db.dbworld.stream.processor.StreamLogger;
import com.db.dbworld.stream.processor.StreamProcessor;
import lombok.extern.log4j.Log4j2;
import org.apache.commons.io.FileUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Log4j2
@Service
public class MirrorHelper {

    @Autowired
    private StatusService statusService;

    public void postDownloadTasks(String statusId) {
        MirrorStatus mirrorStatus = statusService.getStatusById(statusId);
        if (mirrorStatus == null) {
            log.error("MirrorStatus not found for ID: {}", statusId);
            return;
        }

        try {
            handlePostDownloadTasks(mirrorStatus);
        } catch (IOException | DbWorldException ex) {
            handleFailure(mirrorStatus, ex);
        }
    }

    private void handlePostDownloadTasks(MirrorStatus mirrorStatus) throws IOException, DbWorldException {
        if (mirrorStatus.isCancelled()) {
            handleCancelledStatus(mirrorStatus);
        } else if (mirrorStatus.isFailed()) {
            handleFailedStatus(mirrorStatus);
        } else {
            handleSuccessfulDownload(mirrorStatus);
        }
    }

    private void handleCancelledStatus(MirrorStatus mirrorStatus) throws IOException {
        deleteTempFile(mirrorStatus.getTempFilePath());
        statusService.updateMirrorStatusWithCancelled(mirrorStatus.getId());
    }

    private void handleFailedStatus(MirrorStatus mirrorStatus) throws IOException {
        statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), mirrorStatus.getMessage());
        deleteTempFile(mirrorStatus.getTempFilePath());
    }

    private void handleSuccessfulDownload(MirrorStatus mirrorStatus) throws IOException, DbWorldException {
        if (mirrorStatus.isExtract()) {
            handleExtraction(mirrorStatus);
        } else {
            moveFileToFinalLocation(mirrorStatus);
            statusService.updateMirrorStatusWithSuccess(mirrorStatus.getId());
        }
    }

    private void handleExtraction(MirrorStatus mirrorStatus) throws IOException, DbWorldException {
        statusService.updateMirrorStatusWithExtracting(mirrorStatus.getId());

        try {
            extractAndMoveFiles(mirrorStatus);
            statusService.updateMirrorStatusWithSuccess(mirrorStatus.getId());
            log.info("Extract Completed for file: {}", mirrorStatus.getFileName());
        } catch (ExtractException ex) {
            handleExtractionFailure(mirrorStatus, ex);
        }
    }

    private void extractAndMoveFiles(MirrorStatus mirrorStatus) throws IOException, ExtractException {
        extract(mirrorStatus.getId(), mirrorStatus.getTempFilePath(),
                mirrorStatus.getTempExtractedFilePath(), null);

        log.info("Moving folder \"{}\" ===> \"{}\"",
                mirrorStatus.getTempExtractedFilePath(),
                mirrorStatus.getExtractedFileName());

        FileUtils.moveDirectory(
                new File(mirrorStatus.getTempExtractedFilePath()),
                new File(mirrorStatus.getExtractedFilePath()));

        deleteTempFile(mirrorStatus.getTempFilePath());
    }

    private void handleExtractionFailure(MirrorStatus mirrorStatus, ExtractException ex)
            throws IOException, DbWorldException {
        moveFileToFinalLocation(mirrorStatus);
        StreamLogger.appendHtmlLine(mirrorStatus, ex.getMessage(), true, statusService);
        throw new DbWorldException(ex.getMessage());
    }

    private void moveFileToFinalLocation(MirrorStatus mirrorStatus) throws IOException {
        FileUtils.moveFile(
                new File(mirrorStatus.getTempFilePath()),
                new File(mirrorStatus.getFilePath()),
                StandardCopyOption.REPLACE_EXISTING
        );
    }

    private void deleteTempFile(String tempFilePath) throws IOException {
        if (tempFilePath != null) {
            Files.delete(Path.of(tempFilePath));
        }
    }

    private void handleFailure(MirrorStatus mirrorStatus, Exception ex) {
        statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), ex.getMessage());
        log.error("Error processing post-download tasks for {}: {}",
                mirrorStatus.getFileName(), ex.getMessage(), ex);

        // Attempt to clean up temp file if possible
        try {
            if (mirrorStatus.getTempFilePath() != null) {
                Files.deleteIfExists(Path.of(mirrorStatus.getTempFilePath()));
            }
        } catch (IOException ioEx) {
            log.warn("Failed to delete temp file {}: {}",
                    mirrorStatus.getTempFilePath(), ioEx.getMessage());
        }
    }

    public void extract(String mirrorId, String sourcePath, String targetPath, String password) throws IOException {
        ProcessBuilder pb = new ProcessBuilder("7z", "x", sourcePath, "-o" + targetPath, "-aou");
        pb.redirectErrorStream(true);
        Process process = pb.start();

        MirrorStatus mirrorStatus = statusService.getStatusById(mirrorId);
        StreamProcessor streamProcessor = new GenericStreamProcessor(statusService, mirrorStatus);

        Thread streamThread = new Thread(() -> streamProcessor.handle(process.getInputStream(), false));
        streamThread.start();

        try {
            int exitCode = process.waitFor();
            streamThread.join(); // Ensure log thread finishes reading
            if (exitCode != 0) {
                throw new ExtractException("Extraction failed. Exit code: " + exitCode);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ExtractException("Extraction interrupted: " + e.getMessage());
        }
    }
}
