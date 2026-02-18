package com.db.dbworld.services.media;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.handler.MediaFileHandler;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.payloads.mediafile.MediaFileDetails;
import com.db.dbworld.services.mirror.StatusService;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.File;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Log4j2
@Service
public class MediaModificationService {

    private static final String MEDIA_PROCESSING_STARTED = "🔄 Starting media processing...";
    private static final String PROCESSING_WITH_RECORD_ID = "📁 Processing with record ID: ";
    private static final String PROCESSING_UNASSIGNED = "📁 Processing as unassigned file";
    private static final String MEDIA_PROCESSING_SUCCESS = "✅ Media processing completed successfully!";
    private static final String DUPLICATE_FILE_WARNING = "⚠️ Duplicate media file entry detected. File might already be processed.";
    private static final String SKIPPING_DUPLICATE = "ℹ️ Skipping database entry as file already exists.";
    private static final String FILE_ALREADY_EXISTS = "✅ File already exists in database - skipping";
    private static final String MEDIA_PROCESSING_ERROR_PREFIX = "❌ Media processing error: ";
    private static final String MEDIA_PROCESSING_FAILED = "❌ Media processing failed";

    private final StatusService statusService;
    private final MediaFileHandler mediaFileHandler;
    private final MediaFileUtils mediaFileUtils;

    private final ExecutorService mediaProcessingExecutor = Executors.newFixedThreadPool(3);

    @Autowired
    public MediaModificationService(
            StatusService statusService,
            MediaFileHandler mediaFileHandler,
            MediaFileUtils mediaFileUtils) {
        this.statusService = statusService;
        this.mediaFileHandler = mediaFileHandler;
        this.mediaFileUtils = mediaFileUtils;
    }

    @Async
    public CompletableFuture<Void> processMediaAsync(MirrorStatus mirrorStatus) {
        return CompletableFuture.runAsync(() -> {
            try {
                log.info("Starting media processing for ID: {}", mirrorStatus.getId());
                processMediaFile(mirrorStatus);
                log.info("Media processing completed for ID: {}", mirrorStatus.getId());
            } catch (Exception e) {
                handleProcessingFailure(mirrorStatus, e);
                throw new DbWorldException("Media processing failed", e);
            }
        }, mediaProcessingExecutor);
    }

    private void processMediaFile(MirrorStatus mirrorStatus) {
        validateMirrorStatus(mirrorStatus);

        log.info("Processing media file: {}", mirrorStatus.getFileName());
        logStatusToParent(mirrorStatus, MEDIA_PROCESSING_STARTED, false);

        validateTempFilePath(mirrorStatus.getTempFilePath());
        File mediaFile = validateMediaFile(mirrorStatus.getTempFilePath());

        if (hasValidRecordId(mirrorStatus)) {
            processAssignedFile(mirrorStatus, mediaFile);
        } else {
            processUnassignedFile(mirrorStatus, mediaFile);
        }
    }

    private void validateMirrorStatus(MirrorStatus mirrorStatus) {
        if (mirrorStatus == null) {
            throw new IllegalArgumentException("MirrorStatus cannot be null");
        }
    }

    private void validateTempFilePath(String tempFilePath) {
        if (!StringUtils.hasText(tempFilePath)) {
            throw new DbWorldException("Temp file path is null or empty");
        }
    }

    private File validateMediaFile(String tempFilePath) {
        File mediaFile = new File(tempFilePath);
        if (!mediaFile.exists() || !mediaFile.isFile()) {
            throw new DbWorldException("Media file does not exist or is not a valid file: " + tempFilePath);
        }
        return mediaFile;
    }

    private boolean hasValidRecordId(MirrorStatus mirrorStatus) {
        return mirrorStatus.getRecordId() != null && mirrorStatus.getRecordId() > 0;
    }

    private void processAssignedFile(MirrorStatus mirrorStatus, File mediaFile) {
        logStatusToParent(mirrorStatus, PROCESSING_WITH_RECORD_ID + mirrorStatus.getRecordId(), false);

        MediaFileDetails mediaFileDetails = createMediaFileDetails(mirrorStatus.getTempFilePath());

        try {
            mediaFileHandler.processExistingAssignedFile(mediaFile, mediaFileDetails);
            log.info("Successfully processed assigned file: {}", mediaFile.getName());
            logStatusToParent(mirrorStatus, MEDIA_PROCESSING_SUCCESS, false);
        } catch (DataIntegrityViolationException e) {
            handleDuplicateFile(mirrorStatus, mediaFile, e);
        }
    }

    private MediaFileDetails createMediaFileDetails(String filePath) {
        return mediaFileUtils.createMediaFileDetails(filePath)
                .orElseThrow(() -> new DbWorldException("Unable to create MediaFileDetails from path: " + filePath));
    }

    private void handleDuplicateFile(MirrorStatus mirrorStatus, File mediaFile, DataIntegrityViolationException e) {
        log.warn("Duplicate file detected: {}", mediaFile.getAbsolutePath(), e);

        // Log to both current and parent status
        logStatusToParent(mirrorStatus, DUPLICATE_FILE_WARNING, true);
        logStatusToParent(mirrorStatus, SKIPPING_DUPLICATE, false);
        logStatusToParent(mirrorStatus, FILE_ALREADY_EXISTS, false);

        log.info("File already exists in database, skipping: {}", mediaFile.getName());
        // Don't re-throw - this is an expected condition
    }

    private void processUnassignedFile(MirrorStatus mirrorStatus, File mediaFile) {
        logStatusToParent(mirrorStatus, PROCESSING_UNASSIGNED, false);
        mediaFileHandler.processUnassignedFile(mediaFile);
        log.info("Successfully processed unassigned file: {}", mediaFile.getName());
        logStatusToParent(mirrorStatus, MEDIA_PROCESSING_SUCCESS, false);
    }

    private void handleProcessingFailure(MirrorStatus mirrorStatus, Exception e) {
        log.error("Media processing failed for ID: {}", mirrorStatus.getId(), e);

        String errorMessage = extractErrorMessage(e);

        // Log to both current and parent status
        if (mirrorStatus.getId() != null) {
            logStatusToParent(mirrorStatus, MEDIA_PROCESSING_ERROR_PREFIX + errorMessage, true);
            statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), MEDIA_PROCESSING_FAILED);
        } else {
            log.error("Cannot update status: MirrorStatus ID is null");
        }
    }

    private String extractErrorMessage(Exception e) {
        if (e instanceof DbWorldException && e.getCause() != null) {
            return e.getCause().getMessage();
        }
        return e.getMessage();
    }

    /**
     * Logs status message to both the current status and parent status (if exists)
     */
    private void logStatusToParent(MirrorStatus mirrorStatus, String message, boolean isError) {
        try {
            // Always log to current status
            statusService.logAndAppendHtml(mirrorStatus, message, isError);

            // If this is a child status (extracted file), also log to parent
            if (hasParentStatus(mirrorStatus)) {
                MirrorStatus parentStatus = statusService.getStatusById(mirrorStatus.getParentId());
                if (parentStatus != null) {
                    String parentMessage = formatMessageForParent(mirrorStatus, message);
                    statusService.logAndAppendHtml(parentStatus, parentMessage, isError);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to log status update: {}", e.getMessage());
        }
    }

    private boolean hasParentStatus(MirrorStatus mirrorStatus) {
        return mirrorStatus.getParentId() != null &&
                !mirrorStatus.getParentId().isEmpty() &&
                !mirrorStatus.getParentId().equals(mirrorStatus.getId());
    }

    private String formatMessageForParent(MirrorStatus childStatus, String message) {
        // For parent logs, include the child file name for context
        String fileName = childStatus.getFileName();
        if (fileName != null && !fileName.isEmpty()) {
            return String.format("[%s] %s", fileName, message);
        }
        return message;
    }
}