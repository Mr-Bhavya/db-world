package com.db.dbworld.helpers;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.ExtractException;
import com.db.dbworld.handler.MediaFileHandler;
import com.db.dbworld.payloads.MirrorState;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.payloads.mediafile.MediaFileDetails;
import com.db.dbworld.services.cinema.DBCinemaRecordsService;
import com.db.dbworld.services.media.MediaInfoCommandService;
import com.db.dbworld.services.media.MediaModificationService;
import com.db.dbworld.services.mirror.StatusService;
import com.db.dbworld.stream.processor.GenericStreamProcessor;
import com.db.dbworld.stream.processor.StreamLogger;
import com.db.dbworld.stream.processor.StreamProcessor;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import com.db.dbworld.utils.MediaInfoUtils;
import lombok.extern.log4j.Log4j2;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicReference;

import static org.eclipse.jetty.util.URIUtil.normalizePath;

@Log4j2
@Service
public class MirrorHelper {

    @Autowired
    private StatusService statusService;

    @Autowired
    private DbWorldUtils dbWorldUtils;

    @Autowired
    private MediaInfoCommandService mediaInfoCommandService;

    @Autowired
    private DBCinemaRecordsService dbCinemaRecordsService;

    @Autowired
    private MediaInfoUtils mediaInfoUtils;

    @Autowired
    private MediaFileHandler mediaFileHandler;

    @Autowired
    private MediaModificationService mediaModificationService;

    @Autowired
    private ModelMapper modelMapper;

    public void postDownloadTasks(String statusId) {
        MirrorStatus mirrorStatus = statusService.getStatusById(statusId);
        if (mirrorStatus == null) {
            log.error("❌ MirrorStatus not found for ID: {}", statusId);
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
        // Sync the latest status from service
        MirrorStatus latestStatus = statusService.getStatusById(mirrorStatus.getId());
        if (latestStatus == null) {
            throw new DbWorldException("MirrorStatus not found for ID: " + mirrorStatus.getId());
        }

        // Update the local mirrorStatus with latest data
//        syncStatus(mirrorStatus, latestStatus);
        modelMapper.map(latestStatus, mirrorStatus);

        if (mirrorStatus.isCancelled()) {
            statusService.logAndAppendHtml(mirrorStatus, "⚠ Download cancelled for ID: " + mirrorStatus.getId(), false);
            handleCancelledStatus(mirrorStatus);
        } else if (mirrorStatus.isFailed()) {
            statusService.logAndAppendHtml(mirrorStatus, "⚠ Download already marked failed for ID: " + mirrorStatus.getId(), true);
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
        deleteTempFile(mirrorStatus.getTempFilePath());
        statusService.logAndAppendHtml(mirrorStatus, "🗑 Temp file deleted and status updated to failed for ID: " + mirrorStatus.getId(), false);
    }

    private void handleSuccessfulDownload(MirrorStatus mirrorStatus) throws IOException, DbWorldException {
        // Sync status before processing
        syncWithLatestStatus(mirrorStatus);

        if (mirrorStatus.isExtract()) {
            statusService.logAndAppendHtml(mirrorStatus, "📦 File requires extraction: " + mirrorStatus.getFileName(), false);
            handleExtraction(mirrorStatus);
        } else {
            statusService.logAndAppendHtml(mirrorStatus, "📂 Starting media processing for: " + mirrorStatus.getFileName(), false);
            startMediaProcessing(mirrorStatus);
        }
    }

    private void startMediaProcessing(MirrorStatus mirrorStatus) {
        statusService.logAndAppendHtml(mirrorStatus, "🔄 Starting asynchronous media processing...", false);
        statusService.logAndAppendHtml(mirrorStatus, "📁 File: " + mirrorStatus.getFileName(), false);

        // Update status to PROCESSING
        statusService.updateMirrorState(mirrorStatus.getId(), MirrorState.FFMPEG);

        // Start async processing with proper error handling
        CompletableFuture<Void> processingFuture = mediaModificationService.processMediaAsync(mirrorStatus)
                .thenAccept(result -> {
                    // Sync status before final updates
                    syncWithLatestStatus(mirrorStatus);

                    if (mirrorStatus.isCancelled()) {
                        log.info("Media processing cancelled for ID: {}", mirrorStatus.getId());
                        statusService.logAndAppendHtml(mirrorStatus, "⏹ Media processing cancelled", false);
                        return;
                    }

                    if (mirrorStatus.isFailed()) {
                        log.info("Media processing failed for ID: {}", mirrorStatus.getId());
                        statusService.logAndAppendHtml(mirrorStatus, "❌ Media processing failed", false);
                        return;
                    }

                    log.info("Media processing completed successfully for ID: {}", mirrorStatus.getId());
                    statusService.logAndAppendHtml(mirrorStatus, "✅ Media processing completed successfully!", false);

                    // Update final status ONLY if not failed or cancelled
                    statusService.updateMirrorStatusWithSuccess(mirrorStatus.getId());
                    statusService.logAndAppendHtml(mirrorStatus, "🎉 File is now ready for streaming", false);
                })
                .exceptionally(throwable -> {
                    log.error("Media processing failed for ID: {}", mirrorStatus.getId(), throwable);

                    // Sync status before error handling
                    syncWithLatestStatus(mirrorStatus);

                    // Mark as failed in the database
                    if (!mirrorStatus.isCancelled()) {
                        String errorMessage = "Media processing failed: " + throwable.getMessage();
                        statusService.logAndAppendHtml(mirrorStatus, "❌ " + errorMessage, true);
                        statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), errorMessage);
                    } else {
                        statusService.logAndAppendHtml(mirrorStatus, "⏹ Media processing cancelled", false);
                    }
                    return null;
                });

        statusService.logAndAppendHtml(mirrorStatus, "🚀 Media processing started in background", false);

        // Monitor the processing future for cancellation
        monitorProcessingStatus(mirrorStatus, processingFuture);
    }

    private void monitorProcessingStatus(MirrorStatus mirrorStatus, CompletableFuture<Void> processingFuture) {
        CompletableFuture.runAsync(() -> {
            while (!processingFuture.isDone()) {
                try {
                    Thread.sleep(1000); // Check every second

                    // Sync with latest status
                    syncWithLatestStatus(mirrorStatus);

                    if (mirrorStatus.isCancelled()) {
                        log.info("Cancellation detected for media processing ID: {}", mirrorStatus.getId());
                        // Cancel the processing future
                        processingFuture.cancel(true);
                        break;
                    }
                } catch (Exception e) {
                    log.warn("Error monitoring processing status for ID: {}", mirrorStatus.getId(), e);
                    break;
                }
            }
        });
    }

    private void handleExtraction(MirrorStatus mirrorStatus) throws IOException, DbWorldException {
        // Sync status before extraction
        syncWithLatestStatus(mirrorStatus);

        if (mirrorStatus.isCancelled()) {
            statusService.logAndAppendHtml(mirrorStatus, "⏹ Extraction cancelled before starting", false);
            return;
        }

        statusService.updateMirrorStatusWithExtracting(mirrorStatus.getId());
        statusService.logAndAppendHtml(mirrorStatus, "📦 Extraction started for: " + mirrorStatus.getFileName(), false);

        try {
            extractAndMoveFiles(mirrorStatus);

            // Sync status after extraction
            syncWithLatestStatus(mirrorStatus);

            if (!mirrorStatus.isCancelled()) {
                statusService.updateMirrorStatusWithSuccess(mirrorStatus.getId());
                statusService.logAndAppendHtml(mirrorStatus, "✅ Extraction completed and status updated to success for file: " + mirrorStatus.getFileName(), false);
            } else {
                statusService.logAndAppendHtml(mirrorStatus, "⏹ Extraction completed but status was cancelled", false);
            }
        } catch (ExtractException ex) {
            // Sync status on failure
            syncWithLatestStatus(mirrorStatus);

            if (!mirrorStatus.isCancelled()) {
                String errorMsg = "❌ Extraction failed for file: " + mirrorStatus.getFileName() + " - " + ex.getMessage();
                statusService.logAndAppendHtml(mirrorStatus, errorMsg, true);
                handleExtractionFailure(mirrorStatus, ex);
            } else {
                statusService.logAndAppendHtml(mirrorStatus, "⏹ Extraction failed but status was already cancelled", false);
            }
        }
    }

    private void extractAndMoveFiles(MirrorStatus mirrorStatus) throws IOException, ExtractException {
        statusService.logAndAppendHtml(mirrorStatus, "📦 Running extraction for: " + mirrorStatus.getTempFilePath(), false);

        // Check for cancellation before extraction
        syncWithLatestStatus(mirrorStatus);
        if (mirrorStatus.isCancelled()) {
            throw new ExtractException("Extraction cancelled by user");
        }

        extract(mirrorStatus.getId(), mirrorStatus.getTempFilePath(),
                mirrorStatus.getTempExtractedFilePath(), null);

        // Check for cancellation after extraction
        syncWithLatestStatus(mirrorStatus);
        if (mirrorStatus.isCancelled()) {
            statusService.logAndAppendHtml(mirrorStatus, "⏹ Extraction completed but moving cancelled", false);
            return;
        }

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

        // Check if cancelled before fallback
        syncWithLatestStatus(mirrorStatus);
        if (!mirrorStatus.isCancelled()) {
            moveFileToFinalLocation(mirrorStatus);
            StreamLogger.appendHtmlLine(mirrorStatus, ex.getMessage(), true, statusService);
            throw new DbWorldException(ex.getMessage());
        } else {
            statusService.logAndAppendHtml(mirrorStatus, "⏹ Fallback move cancelled", false);
        }
    }

    private void moveFileToFinalLocation(MirrorStatus mirrorStatus) throws DbWorldException {
        statusService.logAndAppendHtml(mirrorStatus, "📂 Attempting to move file from " + mirrorStatus.getTempFilePath() +
                " to " + mirrorStatus.getFilePath(), false);

        // Check cancellation before move
        syncWithLatestStatus(mirrorStatus);
        if (mirrorStatus.isCancelled()) {
            throw new DbWorldException("File move cancelled by user");
        }

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
        if (mirrorStatus == null) {
            throw new ExtractException("MirrorStatus not found for ID: " + mirrorId);
        }

        statusService.logAndAppendHtml(mirrorStatus, "📦 Starting extraction with 7z for: " + sourcePath, false);

        try {
            ProcessBuilder pb = new ProcessBuilder("7z", "x", "-bsp1", "-bb1", sourcePath, "-o" + targetPath, "-aoa");
            pb.redirectErrorStream(true);
            Process process = pb.start();

            StreamProcessor streamProcessor = new GenericStreamProcessor(statusService, mirrorStatus);

            Thread streamThread = new Thread(() -> {
                try {
                    streamProcessor.handle(process.getInputStream(), false);
                } catch (Exception e) {
                    log.error("Error in stream processing for extraction", e);
                }
            });
            streamThread.start();

            // Monitor for cancellation during extraction
            AtomicReference<Boolean> cancelled = new AtomicReference<>(false);
            Thread monitorThread = new Thread(() -> {
                while (process.isAlive() && !cancelled.get()) {
                    try {
                        Thread.sleep(1000);
                        // Sync status and check for cancellation
                        syncWithLatestStatus(mirrorStatus);
                        if (mirrorStatus.isCancelled()) {
                            cancelled.set(true);
                            process.destroy();
                            break;
                        }
                    } catch (Exception e) {
                        log.warn("Error monitoring extraction cancellation", e);
                    }
                }
            });
            monitorThread.start();

            int exitCode = process.waitFor();
            streamThread.join();
            monitorThread.join();

            if (cancelled.get()) {
                throw new ExtractException("Extraction cancelled by user");
            }

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

    /**
     * Sync the local MirrorStatus object with the latest data from the service
     */
    private void syncWithLatestStatus(MirrorStatus mirrorStatus) {
        try {
            MirrorStatus latestStatus = statusService.getStatusById(mirrorStatus.getId());
            if (latestStatus != null) {
                modelMapper.map(latestStatus, mirrorStatus);
            }
        } catch (Exception e) {
            log.warn("Failed to sync status for ID: {}", mirrorStatus.getId(), e);
        }
    }

    /**
     * Synchronize all status fields and logs between two MirrorStatus objects
     */
    private void syncStatus(MirrorStatus target, MirrorStatus source) {
        // Sync basic status fields
//        target.setCancelled(source.isCancelled());
//        target.setFailed(source.isFailed());
//        target.setCompleted(source.isCompleted());
//        target.setPause(source.isPause());
//        target.setSuccess(source.isSuccess());
//
//        // Sync current state and status
//        target.setCurrentState(source.getCurrentState());
//        target.setCurrentStatus(source.getCurrentStatus());
//
//        // Sync file ready status
//        target.setFileReadyForMove(source.isFileReadyForMove());

        // Sync download progress if available
        if (source.getDownloadStatus() != null && target.getDownloadStatus() != null) {
            target.getDownloadStatus().setSpeed(source.getDownloadStatus().getSpeed());
            target.getDownloadStatus().setFileDownloaded(source.getDownloadStatus().getFileDownloaded());
            target.getDownloadStatus().setFileRemaining(source.getDownloadStatus().getFileRemaining());
            target.getDownloadStatus().setEta(source.getDownloadStatus().getEta());
            target.getDownloadStatus().setTotalFileSize(source.getDownloadStatus().getTotalFileSize());
            target.getDownloadStatus().setUpdateTime(source.getDownloadStatus().getUpdateTime());
        }

        // Sync message/logs (append new logs if any)
        if (source.getMessage() != null && !source.getMessage().equals(target.getMessage())) {
            target.setMessage(source.getMessage());
        }

        // Sync file paths if changed
        if (source.getFilePath() != null) target.setFilePath(source.getFilePath());
        if (source.getTempFilePath() != null) target.setTempFilePath(source.getTempFilePath());
        if (source.getExtractedFilePath() != null) target.setExtractedFilePath(source.getExtractedFilePath());
        if (source.getTempExtractedFilePath() != null) target.setTempExtractedFilePath(source.getTempExtractedFilePath());
    }

    private void ffmpegOperation(MirrorStatus mirrorStatus){
        // Implementation for ffmpeg operations
        String recordId = String.valueOf(mirrorStatus.getRecordId());
        String recordType = "";
    }
}