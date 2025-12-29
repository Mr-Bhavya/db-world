package com.db.dbworld.helpers;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.ExtractException;
import com.db.dbworld.exceptions.ProcessExecutionException;
import com.db.dbworld.factory.MirrorStatusFactory;
import com.db.dbworld.payloads.MirrorState;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.media.MediaModificationService;
import com.db.dbworld.services.mirror.StatusService;
import com.db.dbworld.stream.processor.StreamProcessorFactory;
import com.db.dbworld.utils.DbWorldRuntimeProperties;
import lombok.extern.log4j.Log4j2;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Log4j2
@Service
public class MirrorHelper {

    private final StatusService statusService;
    private final MirrorStatusFactory mirrorStatusFactory;
    private final MediaModificationService mediaModificationService;
    private final ProcessExecutor processExecutor;

    // Cache for active processing
    private final ConcurrentHashMap<String, MirrorStatus> statusCache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AtomicBoolean> cancellationFlags = new ConcurrentHashMap<>();

    // File processing tracking
    private static class FileProcessingTracker {
        final AtomicInteger processedCount = new AtomicInteger(0);
        final AtomicInteger totalFiles = new AtomicInteger(0);
        volatile boolean initialized = false;
    }

    private final ConcurrentHashMap<String, FileProcessingTracker> fileTrackers = new ConcurrentHashMap<>();

    public MirrorHelper(
            StatusService statusService,
            MirrorStatusFactory mirrorStatusFactory,
            MediaModificationService mediaModificationService,
            ProcessExecutor processExecutor
    ) {
        this.statusService = statusService;
        this.mirrorStatusFactory = mirrorStatusFactory;
        this.mediaModificationService = mediaModificationService;
        this.processExecutor = processExecutor;
    }

    @Async
    public void postDownloadTasks(String statusId) {
        try {
            MirrorStatus mirrorStatus = fetchAndCacheStatus(statusId)
                    .orElseThrow(() -> new DbWorldException("MirrorStatus not found for ID: " + statusId));

            logStatusUpdate(mirrorStatus, "🔍 Starting post-download tasks", false);

            switch (mirrorStatus.getCurrentState()) {
                case CANCELLED:
                    handleCancelledStatus(mirrorStatus);
                    break;
                case FAILED:
                    handleFailedStatus(mirrorStatus);
                    break;
                default:
                    handleDownloadCompletion(mirrorStatus);
            }
        } catch (Exception ex) {
            log.error("Post-download tasks failed for ID: {}", statusId, ex);
        }
    }

    private void handleCancelledStatus(MirrorStatus mirrorStatus) throws IOException {
        logStatusUpdate(mirrorStatus, "⚠ Download cancelled", false);
        cleanupTempFiles(mirrorStatus);
        statusService.updateMirrorStatusWithCancelled(mirrorStatus.getId());
        cleanupCache(mirrorStatus.getId());
    }

    private void handleFailedStatus(MirrorStatus mirrorStatus) throws IOException {
        logStatusUpdate(mirrorStatus, "⚠ Download failed", false);
        cleanupTempFiles(mirrorStatus);
        cleanupCache(mirrorStatus.getId());
    }

    private void handleDownloadCompletion(MirrorStatus mirrorStatus) throws IOException, DbWorldException {
        logStatusUpdate(mirrorStatus, "✅ Download completed, starting processing", false);

        if (mirrorStatus.isExtract()) {
            handleExtraction(mirrorStatus);
        } else {
            startMediaProcessing(mirrorStatus);
        }
    }

    private void handleExtraction(MirrorStatus mirrorStatus) {
        try {
            updateState(mirrorStatus, MirrorState.EXTRACT);
            logStatusUpdate(mirrorStatus, "📦 Starting extraction", false);

            extractArchive(mirrorStatus);

            if (!isCancelled(mirrorStatus.getId())) {
                logStatusUpdate(mirrorStatus, "✅ Extraction completed successfully", false);
                processExtractedFiles(mirrorStatus);
            }
        } catch (ExtractException ex) {
            handleExtractionFailure(mirrorStatus, ex);
        } catch (Exception ex) {
            log.error("Unexpected error during extraction for ID: {}", mirrorStatus.getId(), ex);
            markAsFailed(mirrorStatus, "Extraction failed: " + ex.getMessage());
        }
    }

    private void extractArchive(MirrorStatus mirrorStatus) throws ExtractException {
        try {
            // Execute extraction
            processExecutor.executeExtraction(
                    mirrorStatus.getTempFilePath(),
                    mirrorStatus.getTempExtractedFilePath(),
                    StreamProcessorFactory.createGenericProcessor(statusService, mirrorStatus),
                    cancellationFlags.get(mirrorStatus.getId()),
                    Duration.ofHours(2) // 2-hour timeout for extraction
            );

        } catch (ProcessExecutionException e) {
            throw new ExtractException("Extraction error: " + e.getMessage());
        }
    }

    private void monitorCancellationDuringProcess(String statusId, Process process) {
        while (process.isAlive()) {
            if (isCancelled(statusId)) {
                process.destroy();
                break;
            }
            try {
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
    }

    private void processExtractedFiles(MirrorStatus parentStatus) {
        try {
            List<File> mediaFiles = findMediaFiles(parentStatus.getTempExtractedFilePath());

            if (CollectionUtils.isEmpty(mediaFiles)) {
                logStatusUpdate(parentStatus, "📭 No media files found after extraction", false);
                markAsFailed(parentStatus, "No media files found after extraction");
                return;
            }

            logStatusUpdate(parentStatus, "📊 Found " + mediaFiles.size() + " media file(s)", false);

            // Initialize tracker BEFORE starting any processing
            FileProcessingTracker tracker = new FileProcessingTracker();
            tracker.totalFiles.set(mediaFiles.size());
            tracker.initialized = true;
            fileTrackers.put(parentStatus.getId(), tracker);

            // Process each file
            for (File mediaFile : mediaFiles) {
                if (isCancelled(parentStatus.getId())) {
                    logStatusUpdate(parentStatus, "⏹ Processing cancelled, skipping remaining files", false);
                    break;
                }

                logStatusUpdate(parentStatus, "🔍 Processing extracted file: " + mediaFile.getName(), false);
                processExtractedFileAsync(parentStatus, mediaFile);
            }

        } catch (Exception ex) {
            log.error("Error processing extracted files for ID: {}", parentStatus.getId(), ex);
            markAsFailed(parentStatus, "Error processing extracted files: " + ex.getMessage());
        }
    }

    private List<File> findMediaFiles(String directoryPath) throws IOException {
        Path startPath = Path.of(directoryPath);

        if (!Files.exists(startPath) || !Files.isDirectory(startPath)) {
            throw new IOException("Extracted directory not found: " + directoryPath);
        }

        try (Stream<Path> walk = Files.walk(startPath)) {
            return walk
                    .filter(Files::isRegularFile)
                    .map(Path::toFile)
                    .collect(Collectors.toList());
        }
    }

    private void processExtractedFileAsync(MirrorStatus parentStatus, File mediaFile) {
        CompletableFuture.runAsync(() -> {
            try {
                // Create child status (but don't save it - use it only for processing)
                MirrorStatus childStatus = createExtractedFileStatus(parentStatus, mediaFile);

                // Log to parent about starting this file
                logStatusUpdate(parentStatus, "🔄 Starting media processing for: " + mediaFile.getName(), false);

                // Process the file
                mediaModificationService.processMediaAsync(childStatus)
                        .thenRun(() -> {
                            // Success - log to parent
                            logStatusUpdate(parentStatus, "✅ Completed processing for: " + mediaFile.getName(), false);
                            updateProcessingProgress(parentStatus);
                        })
                        .exceptionally(ex -> {
                            // Failure - log to parent
                            String errorMsg = extractErrorMessage(ex);
                            if (isDuplicateEntryError(errorMsg)) {
                                logStatusUpdate(parentStatus, "⚠️ File already exists: " + mediaFile.getName(), false);
                                logStatusUpdate(parentStatus, "✅ Skipping duplicate file: " + mediaFile.getName(), false);
                            } else {
                                logStatusUpdate(parentStatus, "❌ Failed to process: " + mediaFile.getName() + " - " + errorMsg, true);
                            }
                            updateProcessingProgress(parentStatus);
                            return null;
                        });

            } catch (Exception e) {
                log.error("Error setting up processing for file: {}", mediaFile.getAbsolutePath(), e);
                logStatusUpdate(parentStatus, "❌ Error processing: " + mediaFile.getName() + " - " + e.getMessage(), true);
                updateProcessingProgress(parentStatus);
            }
        });
    }

    private synchronized void updateProcessingProgress(MirrorStatus parentStatus) {
        FileProcessingTracker tracker = fileTrackers.get(parentStatus.getId());
        if (tracker == null || !tracker.initialized) {
            log.warn("Tracker not initialized for ID: {}", parentStatus.getId());
            return;
        }

        int processed = tracker.processedCount.incrementAndGet();
        int total = tracker.totalFiles.get();

        logStatusUpdate(parentStatus, "📈 Progress: " + processed + "/" + total + " files processed", false);

        // Check if all files are processed
        if (processed >= total) {
            if (!isCancelled(parentStatus.getId())) {
                updateState(parentStatus, MirrorState.SUCCESS);
                logStatusUpdate(parentStatus, "✅ All extracted files processed successfully", false);
            }
            // Clean up tracker
            fileTrackers.remove(parentStatus.getId());
        }
    }

    private MirrorStatus createExtractedFileStatus(MirrorStatus parentStatus, File mediaFile) throws IOException {
        MirrorStatus fileStatus = mirrorStatusFactory.create(
                parentStatus.getFolderName(),
                null,
                mediaFile.getName(),
                Files.size(mediaFile.toPath()),
                false
        );

        fileStatus.setParentId(parentStatus.getId());
        fileStatus.setTempFileName(mediaFile.getName());
        fileStatus.setTempFilePath(mediaFile.getPath());
        fileStatus.transitionTo(MirrorState.FFMPEG);

        return fileStatus;
    }

    private void startMediaProcessing(MirrorStatus mirrorStatus) {
        updateState(mirrorStatus, MirrorState.FFMPEG);
        logStatusUpdate(mirrorStatus, "🔄 Starting media processing", false);

        mediaModificationService.processMediaAsync(mirrorStatus)
                .thenRun(() -> handleMediaProcessingSuccess(mirrorStatus))
                .exceptionally(ex -> {
                    handleMediaProcessingFailure(mirrorStatus, ex);
                    return null;
                });
    }

    private void handleMediaProcessingSuccess(MirrorStatus mirrorStatus) {
        if (!isCancelled(mirrorStatus.getId())) {
            logStatusUpdate(mirrorStatus, "✅ Media processing completed successfully", false);
            updateState(mirrorStatus, MirrorState.SUCCESS);
        }
    }

    private void handleMediaProcessingFailure(MirrorStatus mirrorStatus, Throwable throwable) {
        if (!isCancelled(mirrorStatus.getId())) {
            String errorMessage = extractErrorMessage(throwable);
            log.error("Media processing failed for ID: {} - {}", mirrorStatus.getId(), errorMessage);

            // Check for duplicate entry (which should be treated as success)
            if (isDuplicateEntryError(errorMessage)) {
                logStatusUpdate(mirrorStatus, "⚠️ File already exists in database - skipping", false);
                logStatusUpdate(mirrorStatus, "✅ Media processing completed (file already exists)", false);
                updateState(mirrorStatus, MirrorState.SUCCESS);
            } else {
                logStatusUpdate(mirrorStatus, "❌ Media processing failed: " + errorMessage, true);
                markAsFailed(mirrorStatus, "Media processing failed: " + errorMessage);
            }
        }
    }

    private String extractErrorMessage(Throwable throwable) {
        if (throwable == null) return "Unknown error";

        if (throwable instanceof CompletionException && throwable.getCause() != null) {
            return extractErrorMessage(throwable.getCause());
        }

        Throwable cause = throwable;
        while (cause.getCause() != null && cause.getCause() != cause) {
            cause = cause.getCause();
        }

        String message = cause.getMessage();
        if (message == null || message.isEmpty()) {
            message = cause.getClass().getSimpleName();
        }

        return message;
    }

    private boolean isDuplicateEntryError(String errorMessage) {
        if (errorMessage == null) return false;

        String lowerError = errorMessage.toLowerCase();
        return lowerError.contains("duplicate") ||
                lowerError.contains("already exists") ||
                lowerError.contains("unique constraint") ||
                lowerError.contains("constraint violation");
    }

    private void handleExtractionFailure(MirrorStatus mirrorStatus, ExtractException ex) {
        logStatusUpdate(mirrorStatus, "❌ Extraction failed: " + ex.getMessage(), true);
        markAsFailed(mirrorStatus, "Extraction failed: " + ex.getMessage());
    }

    // ==================== Utility Methods ====================

    private Optional<MirrorStatus> fetchAndCacheStatus(String statusId) {
        try {
            MirrorStatus status = statusService.getStatusById(statusId);
            if (status != null) {
                statusCache.put(statusId, status);
                cancellationFlags.putIfAbsent(statusId, new AtomicBoolean(false));
            }
            return Optional.ofNullable(status);
        } catch (Exception e) {
            log.error("Failed to fetch status for ID: {}", statusId, e);
            return Optional.empty();
        }
    }

    private boolean isCancelled(String statusId) {
        AtomicBoolean flag = cancellationFlags.get(statusId);
        return flag != null && flag.get();
    }

    private void updateState(MirrorStatus mirrorStatus, MirrorState newState) {
        try {
            mirrorStatus.transitionTo(newState);
            statusService.updateMirrorState(mirrorStatus.getId(), newState);
            statusCache.put(mirrorStatus.getId(), mirrorStatus);
        } catch (Exception e) {
            log.error("Failed to update state for ID: {}", mirrorStatus.getId(), e);
        }
    }

    private void markAsFailed(MirrorStatus mirrorStatus, String errorMessage) {
        try {
            statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), errorMessage);
            logStatusUpdate(mirrorStatus, errorMessage, true);
        } catch (Exception e) {
            log.error("Failed to mark as failed for ID: {}", mirrorStatus.getId(), e);
        } finally {
            cleanupCache(mirrorStatus.getId());
        }
    }

    private void logStatusUpdate(MirrorStatus mirrorStatus, String message, boolean isError) {
        try {
            statusService.logAndAppendHtml(mirrorStatus, message, isError);
        } catch (Exception e) {
            log.warn("Failed to log status update for ID: {}", mirrorStatus.getId(), e);
        }
    }

    private void cleanupTempFiles(MirrorStatus mirrorStatus) throws IOException {
        if (mirrorStatus.getTempFilePath() != null) {
            Files.deleteIfExists(Path.of(mirrorStatus.getTempFilePath()));
            log.debug("Cleaned up temp file: {}", mirrorStatus.getTempFilePath());
        }
    }

    private void cleanupCache(String statusId) {
        statusCache.remove(statusId);
        cancellationFlags.remove(statusId);
        fileTrackers.remove(statusId);
    }

    // ==================== Public API for Cancellation ====================

    public void cancelProcessing(String statusId) {
        try {
            AtomicBoolean flag = cancellationFlags.get(statusId);
            if (flag != null) {
                flag.set(true);
            }

            MirrorStatus status = statusCache.get(statusId);
            if (status != null) {
                status.transitionTo(MirrorState.CANCELLED);
            }

            statusService.updateMirrorStatusWithCancelled(statusId);
            log.info("Processing cancelled for ID: {}", statusId);

        } catch (Exception e) {
            log.error("Failed to cancel processing for ID: {}", statusId, e);
        }
    }

    public boolean isProcessingActive(String statusId) {
        return statusCache.containsKey(statusId) && !isCancelled(statusId);
    }
}