package com.db.dbworld.helpers;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.ExtractException;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.mirror.StatusService;
import com.db.dbworld.stream.processor.GenericStreamProcessor;
import com.db.dbworld.stream.processor.StreamLogger;
import com.db.dbworld.stream.processor.StreamProcessor;
import com.db.dbworld.utils.DbWorldUtils;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Log4j2
@Service
public class MirrorHelper {

    @Autowired
    private StatusService statusService;

    @Autowired
    private DbWorldUtils dbWorldUtils;

    public void postDownloadTasks(String statusId) {
        MirrorStatus mirrorStatus = statusService.getStatusById(statusId);
        if (mirrorStatus == null) {
            statusService.logAndAppendHtml(null, "❌ MirrorStatus not found for ID: " + statusId, true);
            return;
        }

        statusService.logAndAppendHtml(mirrorStatus, "🔍 Starting post-download tasks for ID: " + statusId, false);

        try {
            handlePostDownloadTasks(mirrorStatus);
        } catch (IOException | DbWorldException ex) {
            String errorMsg = "❌ Post-download task failed for " + mirrorStatus.getFileName() + ": " + ex.getMessage();
            statusService.logAndAppendHtml(mirrorStatus, errorMsg, true);
            handleFailure(mirrorStatus, ex);
        }
    }

    private void handlePostDownloadTasks(MirrorStatus mirrorStatus) throws IOException, DbWorldException {
        if (mirrorStatus.isCancelled()) {
            statusService.logAndAppendHtml(mirrorStatus, "⚠ Download cancelled for ID: " + mirrorStatus.getId(), false);
            handleCancelledStatus(mirrorStatus);
        } else if (mirrorStatus.isFailed()) {
            statusService.logAndAppendHtml(mirrorStatus, "⚠ Download already marked failed for ID: " + mirrorStatus.getId(), false);
            handleFailedStatus(mirrorStatus);
        } else {
            statusService.logAndAppendHtml(mirrorStatus, "✅ Download completed, starting success flow for ID: " + mirrorStatus.getId(), false);
            handleSuccessfulDownload(mirrorStatus);
        }
    }

    private void handleCancelledStatus(MirrorStatus mirrorStatus) throws IOException {
        deleteTempFile(mirrorStatus.getTempFilePath());
        statusService.updateMirrorStatusWithCancelled(mirrorStatus.getId());
        statusService.logAndAppendHtml(mirrorStatus, "🗑 Temp file deleted and status updated to cancelled for ID: " + mirrorStatus.getId(), false);
    }

    private void handleFailedStatus(MirrorStatus mirrorStatus) throws IOException {
        statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), mirrorStatus.getMessage());
        deleteTempFile(mirrorStatus.getTempFilePath());
        statusService.logAndAppendHtml(mirrorStatus, "🗑 Temp file deleted and status updated to failed for ID: " + mirrorStatus.getId(), false);
    }

    private void handleSuccessfulDownload(MirrorStatus mirrorStatus) throws IOException, DbWorldException {
        if (mirrorStatus.isExtract()) {
            statusService.logAndAppendHtml(mirrorStatus, "📦 File requires extraction: " + mirrorStatus.getFileName(), false);
            handleExtraction(mirrorStatus);
        } else {
            statusService.logAndAppendHtml(mirrorStatus, "📂 Moving file to final location: " + mirrorStatus.getFilePath(), false);
            moveFileToFinalLocation(mirrorStatus);
            statusService.updateMirrorStatusWithSuccess(mirrorStatus.getId());
            statusService.logAndAppendHtml(mirrorStatus, "✅ Status updated to success for ID: " + mirrorStatus.getId(), false);
        }
    }

    private void handleExtraction(MirrorStatus mirrorStatus) throws IOException, DbWorldException {
        statusService.updateMirrorStatusWithExtracting(mirrorStatus.getId());
        statusService.logAndAppendHtml(mirrorStatus, "📦 Extraction started for: " + mirrorStatus.getFileName(), false);

        try {
            extractAndMoveFiles(mirrorStatus);
            statusService.updateMirrorStatusWithSuccess(mirrorStatus.getId());
            statusService.logAndAppendHtml(mirrorStatus, "✅ Extraction completed and status updated to success for file: " + mirrorStatus.getFileName(), false);
        } catch (ExtractException ex) {
            String errorMsg = "❌ Extraction failed for file: " + mirrorStatus.getFileName() + " - " + ex.getMessage();
            statusService.logAndAppendHtml(mirrorStatus, errorMsg, true);
            handleExtractionFailure(mirrorStatus, ex);
        }
    }

    private void extractAndMoveFiles(MirrorStatus mirrorStatus) throws IOException, ExtractException {
        statusService.logAndAppendHtml(mirrorStatus, "📦 Running extraction for: " + mirrorStatus.getTempFilePath(), false);
        extract(mirrorStatus.getId(), mirrorStatus.getTempFilePath(),
                mirrorStatus.getTempExtractedFilePath(), null);

        statusService.logAndAppendHtml(mirrorStatus, "📂 Moving extracted folder from \"" + mirrorStatus.getTempExtractedFilePath() +
                "\" to \"" + mirrorStatus.getExtractedFilePath() + "\"", false);

        dbWorldUtils.moveFileOrDir(mirrorStatus.getTempExtractedFilePath(),
                mirrorStatus.getExtractedFilePath(),
                true);

        deleteTempFile(mirrorStatus.getTempFilePath());
        statusService.logAndAppendHtml(mirrorStatus, "🗑 Temp archive deleted after extraction for: " + mirrorStatus.getFileName(), false);
    }

    private void handleExtractionFailure(MirrorStatus mirrorStatus, ExtractException ex) throws DbWorldException {
        statusService.logAndAppendHtml(mirrorStatus, "⚠ Extraction failed, falling back to moving archive as-is for: " + mirrorStatus.getFileName(), true);
        moveFileToFinalLocation(mirrorStatus);
        StreamLogger.appendHtmlLine(mirrorStatus, ex.getMessage(), true, statusService);
        throw new DbWorldException(ex.getMessage());
    }

    private void moveFileToFinalLocation(MirrorStatus mirrorStatus) throws DbWorldException {
        statusService.logAndAppendHtml(mirrorStatus, "📂 Attempting to move file from \"" + mirrorStatus.getTempFilePath() +
                "\" to \"" + mirrorStatus.getFilePath() + "\"", false);
        try {
            mirrorStatus.validatePaths();
            if (mirrorStatus.isFileReadyForMove()) {
                dbWorldUtils.moveFileOrDir(mirrorStatus.getTempFilePath(),
                        mirrorStatus.getFilePath(),
                        true);
                statusService.logAndAppendHtml(mirrorStatus, "✅ File moved successfully for: " + mirrorStatus.getFileName(), false);
            } else {
                throw new DbWorldException("File not ready for moving: " + mirrorStatus.getTempFilePath());
            }
        } catch (IOException e) {
            statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(),
                    "Failed to move file: " + e.getMessage());
            statusService.logAndAppendHtml(mirrorStatus, "❌ Failed to move file for " + mirrorStatus.getFileName() + ": " + e.getMessage(), true);
            throw new DbWorldException("Failed to move file from " +
                    mirrorStatus.getTempFilePath() + " to " +
                    mirrorStatus.getFilePath(), e);
        }
    }

    private void deleteTempFile(String tempFilePath) throws IOException {
        if (tempFilePath != null) {
            Files.deleteIfExists(Path.of(tempFilePath));
            log.debug("🗑 Deleted temp file: {}", tempFilePath);
        }
    }

    private void handleFailure(MirrorStatus mirrorStatus, Exception ex) {
        statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), ex.getMessage());
        statusService.logAndAppendHtml(mirrorStatus, "❌ Error processing post-download tasks for " +
                mirrorStatus.getFileName() + ": " + ex.getMessage(), true);

        try {
            if (mirrorStatus.getTempFilePath() != null) {
                Files.deleteIfExists(Path.of(mirrorStatus.getTempFilePath()));
                statusService.logAndAppendHtml(mirrorStatus, "🗑 Deleted temp file after failure: " + mirrorStatus.getTempFilePath(), false);
            }
        } catch (IOException ioEx) {
            statusService.logAndAppendHtml(mirrorStatus, "⚠ Failed to delete temp file " + mirrorStatus.getTempFilePath() +
                    ": " + ioEx.getMessage(), true);
        }
    }

    public void extract(String mirrorId, String sourcePath, String targetPath, String password) throws ExtractException {
        MirrorStatus mirrorStatus = statusService.getStatusById(mirrorId);
        statusService.logAndAppendHtml(mirrorStatus, "📦 Starting extraction with 7z for: " + sourcePath, false);

        try {
            ProcessBuilder pb = new ProcessBuilder("7z", "x", "-bsp1", "-bb1", sourcePath, "-o" + targetPath, "-aoa");
            pb.redirectErrorStream(true);
            Process process = pb.start();

            StreamProcessor streamProcessor = new GenericStreamProcessor(statusService, mirrorStatus);

            Thread streamThread = new Thread(() -> streamProcessor.handle(process.getInputStream(), false));
            streamThread.start();

            int exitCode = process.waitFor();
            streamThread.join();

            if (exitCode != 0) {
                statusService.logAndAppendHtml(mirrorStatus, "❌ 7z extraction failed with exit code: " + exitCode, true);
                throw new ExtractException("Extraction failed with exit code: " + exitCode);
            }
            statusService.logAndAppendHtml(mirrorStatus, "✅ 7z extraction completed successfully for: " + sourcePath, false);
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            statusService.logAndAppendHtml(mirrorStatus, "❌ Extraction error for " + sourcePath + ": " + e.getMessage(), true);
            throw new ExtractException("Extraction error: " + e.getMessage());
        }
    }

}