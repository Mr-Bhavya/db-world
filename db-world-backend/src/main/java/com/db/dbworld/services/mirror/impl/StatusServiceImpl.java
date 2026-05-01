//package com.db.dbworld.services.mirror.impl;
//
//import com.codahale.metrics.Meter;
//import com.codahale.metrics.MetricRegistry;
//import com.db.dbworld.payloads.MirrorState;
//import com.db.dbworld.payloads.MirrorStatus;
//import com.db.dbworld.services.aria2.model.Aria2Bittorrent;
//import com.db.dbworld.services.aria2.model.Aria2BittorrentInfo;
//import com.db.dbworld.services.aria2.model.Aria2File;
//import com.db.dbworld.services.aria2.model.Aria2StatusParam;
//import com.db.dbworld.services.mirror.StatusService;
//import com.db.dbworld.core.processor.StreamLogger;
//import lombok.extern.log4j.Log4j2;
//import org.springframework.stereotype.Service;
//
//import java.nio.file.Paths;
//import java.util.List;
//import java.util.Map;
//import java.util.Optional;
//import java.util.concurrent.ConcurrentHashMap;
//import java.util.concurrent.ConcurrentMap;
//import java.util.function.Consumer;
//import java.util.stream.Collectors;
//
//@Log4j2
//@Service
//public class StatusServiceImpl implements StatusService {
//
//    // Thread-safe maps for status storage
//    private final ConcurrentMap<String, MirrorStatus> statusMap = new ConcurrentHashMap<>();
//    private final ConcurrentMap<String, String> gidToIdMap = new ConcurrentHashMap<>();
//
//    // Metrics setup
//    private static final MetricRegistry METRIC_REGISTRY = new MetricRegistry();
//    private static final Meter DOWNLOAD_METER = METRIC_REGISTRY.meter("download-speed");
//
//    @Override
//    public Map<String, MirrorStatus> getAllStatus() {
//        return Map.copyOf(statusMap);
//    }
//
//    @Override
//    public MirrorStatus getStatusById(String id) {
//        return Optional.ofNullable(statusMap.get(id))
//                .orElseGet(MirrorStatus::new);
//    }
//
//    @Override
//    public MirrorStatus getMirrorStatusByGid(String gid) {
//        return Optional.ofNullable(gidToIdMap.get(gid))
//                .map(this::getStatusById)
//                .orElseGet(MirrorStatus::new);
//    }
//
//    @Override
//    public void addNewStatus(MirrorStatus mirrorStatus) {
//        if (mirrorStatus != null && mirrorStatus.getId() != null) {
//            statusMap.put(mirrorStatus.getId(), mirrorStatus);
//            if (mirrorStatus.getGid() != null) {
//                gidToIdMap.put(mirrorStatus.getGid(), mirrorStatus.getId());
//            }
//        }
//    }
//
//    @Override
//    public void deleteStatus(String id) {
//        Optional.ofNullable(statusMap.remove(id))
//                .ifPresent(status -> {
//                    if (status.getGid() != null) {
//                        gidToIdMap.remove(status.getGid());
//                    }
//                });
//    }
//
//    @Override
//    public void updateStatus(MirrorStatus mirrorStatus) {
//        if (mirrorStatus != null && mirrorStatus.getId() != null) {
//            mirrorStatus.setTimeStamp(String.valueOf(System.currentTimeMillis()));
//            statusMap.compute(mirrorStatus.getId(), (k, v) -> {
//                if (v != null && v.getGid() != null && !v.getGid().equals(mirrorStatus.getGid())) {
//                    gidToIdMap.remove(v.getGid());
//                }
//                if (mirrorStatus.getGid() != null) {
//                    gidToIdMap.put(mirrorStatus.getGid(), mirrorStatus.getId());
//                }
//                return mirrorStatus;
//            });
//        }
//    }
//
//    // Thread-safe state transition methods
//    @Override
//    public boolean updateMirrorState(String id, MirrorState newState) {
//        return updateStatusWithTransition(id, status ->
//                status.transitionTo(newState)
//        );
//    }
//
//    @Override
//    public boolean updateMirrorState(String id, MirrorState newState, String message) {
//        return updateStatusWithTransition(id, status ->
//                status.transitionTo(newState, message)
//        );
//    }
//
//    private boolean updateStatusWithTransition(String id, Consumer<MirrorStatus> transition) {
//        MirrorStatus status = statusMap.get(id);
//        if (status != null) {
//            transition.accept(status);
//            updateStatus(status);
//            return true;
//        }
//        return false;
//    }
//
//    // Specific state transition methods with validation
//    @Override
//    public boolean pauseMirrorStatus(String id) {
//        boolean success = updateMirrorState(id, MirrorState.PAUSE, "Task paused by user");
//        if (success) {
//            log.info("Task '{}' paused successfully. Filename: {}", id, getStatusById(id).getFileName());
//        }
//        return success;
//    }
//
//    @Override
//    public boolean resumeMirrorStatus(String id) {
//        boolean success = updateMirrorState(id, MirrorState.RESUME, "Task resumed by user");
//        if (success) {
//            log.info("Task '{}' resumed successfully. Filename: {}", id, getStatusById(id).getFileName());
//        }
//        return success;
//    }
//
//    @Override
//    public boolean cancelMirrorStatus(String id) {
//        boolean success = updateMirrorState(id, MirrorState.CANCELLED, "Task cancelled by user");
//        if (success) {
//            log.warn("Task '{}' cancelled. Filename: {}", id, getStatusById(id).getFileName());
//        }
//        return success;
//    }
//
//    @Override
//    public boolean completeMirrorStatus(String id) {
//        boolean success = updateMirrorState(id, MirrorState.SUCCESS, "Task completed successfully");
//        if (success) {
//            log.info("Task '{}' completed successfully. Filename: {}", id, getStatusById(id).getFileName());
//        }
//        return success;
//    }
//
//    @Override
//    public boolean failMirrorStatus(String id, String message) {
//        boolean success = updateMirrorState(id, MirrorState.FAILED, message);
//        if (success) {
//            log.error("Task '{}' failed. Filename: {}, Error: {}", id, getStatusById(id).getFileName(), message);
//        }
//        return success;
//    }
//
//    // Helper method for common update patterns
//    private void updateStatus(String id, Consumer<MirrorStatus> updater) {
//        Optional.ofNullable(statusMap.get(id))
//                .ifPresent(status -> {
//                    updater.accept(status);
//                    updateStatus(status);
//                });
//    }
//
//    @Override
//    public void updateMirrorStatusWithFileSize(String id, Long fileSize) {
//        updateStatus(id, status -> status.setFileSize(fileSize));
//    }
//
//    @Override
//    public void updateStatusMessage(String id, String message) {
//        updateStatus(id, status -> status.setMessage(message));
//    }
//
//    @Override
//    public void updateMirrorStatusWithDownloadState(String id, MirrorStatus.DownloadStatus newDownloadStatus) {
//        updateStatus(id, status -> {
//            status.setDownloadStatus(newDownloadStatus);
//            // Only update to DOWNLOAD state if not in a terminal state
//            if (!status.isCompleted()) {
//                status.transitionTo(MirrorState.DOWNLOAD);
//            }
//        });
//    }
//
//    @Override
//    public void updateMirrorStatusWithNewDownloadBytes(String id, long newBytes) {
//        updateStatus(id, status -> {
//            MirrorStatus.DownloadStatus previousStatus = status.getDownloadStatus();
//            long previousDownloaded = (previousStatus != null) ? previousStatus.getFileDownloaded() : 0;
//            long newDownloaded = previousDownloaded + newBytes;
//
//            if (newBytes > 0) {
//                DOWNLOAD_METER.mark(newBytes);
//            }
//
//            double speed = DOWNLOAD_METER.getOneMinuteRate();
//            long totalFileSize = status.getFileSize();
//            long remaining = totalFileSize - newDownloaded;
//            long eta = (speed > 0 && remaining > 0) ? (long) (remaining / speed) : 0;
//
//            MirrorStatus.DownloadStatus newStatus = new MirrorStatus.DownloadStatus();
//            newStatus.setFileDownloaded(newDownloaded);
//            newStatus.setSpeed(speed);
//            newStatus.setUpdateTime(System.currentTimeMillis());
//            newStatus.setTotalFileSize(totalFileSize);
//            newStatus.setEta(eta);
//            newStatus.setFileRemaining(remaining);
//
//            status.setDownloadStatus(newStatus);
//
//            // Ensure state is DOWNLOAD during active downloading
//            if (!status.isCompleted() && status.getCurrentState() != MirrorState.DOWNLOAD) {
//                status.transitionTo(MirrorState.DOWNLOAD);
//            }
//        });
//    }
//
//    @Override
//    public void updateMirrorStatusWithExtracting(String id) {
//        updateStatus(id, status -> {
//            if (status.transitionTo(MirrorState.EXTRACT, "Extracting file")) {
//                log.info("Extracting File: \"{}\" ===> \"{}\"",
//                        status.getTempFilePath(), status.getTempExtractedFilePath());
//            }
//        });
//    }
//
//    @Override
//    public void updateMirrorStatusWithSuccess(String id) {
//        completeMirrorStatus(id);
//    }
//
//    @Override
//    public void updateMirrorStatusWithFailed(String id, String message) {
//        failMirrorStatus(id, message);
//    }
//
//    @Override
//    public void updateMirrorStatusWithCancelled(String id) {
//        cancelMirrorStatus(id);
//    }
//
//    @Override
//    public void updateMirrorStatusWithPause(String id) {
//        pauseMirrorStatus(id);
//    }
//
//    @Override
//    public void updateMirrorStatusWithResume(String id) {
//        resumeMirrorStatus(id);
//    }
//
//    @Override
//    public void logAndAppendHtml(MirrorStatus mirrorStatus, String message, boolean isError) {
//        if (mirrorStatus != null) {
//            StreamLogger.appendHtmlLine(mirrorStatus, message, isError, this);
//        }
//        if (isError) {
//            log.error(message);
//        } else {
//            log.info(message);
//        }
//    }
//
//    // Additional utility methods
//    @Override
//    public boolean isOperationAllowed(String id, MirrorState requestedState) {
//        MirrorStatus status = getStatusById(id);
//        return status != null && status.isValidTransition(status.getCurrentState(), requestedState);
//    }
//
//    @Override
//    public Map<String, MirrorState> getAllCurrentStates() {
//        return statusMap.entrySet().stream()
//                .collect(Collectors.toMap(
//                        Map.Entry::getKey,
//                        entry -> entry.getValue().getCurrentState()
//                ));
//    }
//
//    @Override
//    public void updateMirrorStatusFromAria2(MirrorStatus mirrorStatus, Aria2StatusParam aria2Status) {
//        if (mirrorStatus == null || aria2Status == null) {
//            log.warn("Cannot update mirror status: mirrorStatus or aria2Status is null");
//            return;
//        }
//
//        try {
//            // Extract basic status information from aria2
//            String aria2StatusStr = aria2Status.getStatus() != null ? aria2Status.getStatus() : "unknown";
//            Long totalLength = aria2Status.getTotalLength() != null ? aria2Status.getTotalLength() : 0L;
//            Long completedLength = aria2Status.getCompletedLength() != null ? aria2Status.getCompletedLength() : 0L;
//            Long downloadSpeed = aria2Status.getDownloadSpeed() != null ? aria2Status.getDownloadSpeed() : 0L;
//            Long uploadSpeed = aria2Status.getUploadSpeed() != null ? aria2Status.getUploadSpeed() : 0L;
//            Integer connections = aria2Status.getConnections() != null ? aria2Status.getConnections() : 0;
//            Integer numSeeders = aria2Status.getNumSeeders() != null ? aria2Status.getNumSeeders() : 0;
//
//            // Update file size if not set or different
//            if (mirrorStatus.getFileSize() == null || !mirrorStatus.getFileSize().equals(totalLength)) {
//                mirrorStatus.setFileSize(totalLength);
//            }
//
//            // Update DownloadStatus
//            MirrorStatus.DownloadStatus downloadStatus = mirrorStatus.getDownloadStatus();
//            if (downloadStatus == null) {
//                downloadStatus = new MirrorStatus.DownloadStatus(completedLength, totalLength);
//            } else {
//                // Update existing download status
//                downloadStatus.setFileDownloaded(completedLength);
//                downloadStatus.setTotalFileSize(totalLength);
//                downloadStatus.setFileRemaining(Math.max(0, totalLength - completedLength));
//                downloadStatus.setSpeed(downloadSpeed > 0 ? downloadSpeed.doubleValue() : null);
//                downloadStatus.setUpdateTime(System.currentTimeMillis());
//
//                // Calculate ETA
//                if (downloadSpeed > 0 && totalLength > completedLength) {
//                    long remainingBytes = totalLength - completedLength;
//                    long etaSeconds = remainingBytes / downloadSpeed;
//                    downloadStatus.setEta(etaSeconds);
//                } else {
//                    downloadStatus.setEta(0L);
//                }
//            }
//            mirrorStatus.setDownloadStatus(downloadStatus);
//
//            // Extract and update file information
//            updateFileInformationFromAria2(mirrorStatus, aria2Status);
//
//            // Update GID if not set
//            if (mirrorStatus.getGid() == null || mirrorStatus.getGid().isEmpty()) {
//                String gid = aria2Status.getGid();
//                if (gid != null && !gid.isEmpty()) {
//                    mirrorStatus.setGid(gid);
//                }
//            }
//
//            // Log status changes for debugging
//            double progressPercentage = calculateProgressPercentage(completedLength, totalLength);
//            String formattedSpeed = formatSpeed(downloadSpeed);
//
//            log.debug("Updated mirror status {}: {}% complete, speed: {}/s, status: {}",
//                    mirrorStatus.getId(),
//                    progressPercentage,
//                    formattedSpeed,
//                    mirrorStatus.getCurrentStatus());
//
//        } catch (Exception e) {
//            log.error("Failed to update mirror status from aria2 data for: {}", mirrorStatus.getId(), e);
//            logAndAppendHtml(mirrorStatus, "Failed to update status: " + e.getMessage(), true);
//        }
//    }
//
//    private void updateFileInformationFromAria2(MirrorStatus mirrorStatus, Aria2StatusParam aria2Status) {
//        boolean fileInfoUpdated = false;
//        String oldFileName = mirrorStatus.getFileName();
//        String oldTempFileName = mirrorStatus.getTempFileName();
//
//        // --- FILES array (normal HTTP/FTP/S3 downloads) ---
//        if (aria2Status.getFiles() != null && !aria2Status.getFiles().isEmpty()) {
//            List<Aria2File> files = aria2Status.getFiles();
//            Aria2File firstFile = files.get(0);
//            String filePath = firstFile.getPath();
//
//            if (filePath != null && !filePath.isEmpty()) {
//                String fileName = Paths.get(filePath).getFileName().toString();
//
//                if (shouldUpdateFileName(mirrorStatus.getFileName(), mirrorStatus.getTempFileName(), fileName)) {
//                    mirrorStatus.setTempFileName(fileName);
//                    mirrorStatus.setFileName(fileName);
//                    fileInfoUpdated = true;
//
//                    logAndAppendHtml(mirrorStatus, "📁 File info updated from Aria2 (files array): " +
//                            (!oldFileName.isEmpty() ? oldFileName + " → " + fileName : fileName), false);
//
//                    log.debug("File name/path changed for {}: {} → {}", mirrorStatus.getGid(), oldFileName, fileName);
//                }
//            }
//        }
//
//        // --- TORRENT info ---
//        if (aria2Status.getBittorrent() != null) {
//            Aria2Bittorrent bittorrent = aria2Status.getBittorrent();
//            Aria2BittorrentInfo info = bittorrent.getInfo();
//            if (info != null) {
//                String torrentName = info.getName();
//
//                if (torrentName != null && !torrentName.isEmpty()) {
//                    if (shouldUpdateFileName(mirrorStatus.getFileName(), mirrorStatus.getTempFileName(), torrentName)) {
//                        mirrorStatus.setTempFileName(torrentName);
//                        mirrorStatus.setFileName(torrentName);
//                        fileInfoUpdated = true;
//
//                        logAndAppendHtml(mirrorStatus, "🧲 Torrent info updated: " +
//                                (!oldFileName.isEmpty() ? oldFileName + " → " + torrentName : torrentName), false);
//
//                        log.debug("Torrent name changed for {}: {} → {}", mirrorStatus.getGid(), oldFileName, torrentName);
//                    }
//                }
//            }
//        }
//
//        // --- FILE TYPE (based on filename extension) ---
//        if (mirrorStatus.getFileName() != null && mirrorStatus.getFileType() == null) {
//            String fileName = mirrorStatus.getFileName();
//            if (fileName.contains(".")) {
//                String extension = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
//                mirrorStatus.setFileType(extension);
//
//                logAndAppendHtml(mirrorStatus, "📄 Detected file type: <b>" + extension + "</b>", false);
//                log.debug("File type set for {}: {}", mirrorStatus.getGid(), extension);
//            }
//        }
//
//        // --- Summary log (optional) ---
//        if (fileInfoUpdated) {
//            log.info("✅ File info updated for GID {} → {}", mirrorStatus.getGid(), mirrorStatus.getFileName());
//        }
//    }
//
//    private boolean shouldUpdateFileName(String currentFileName, String currentTempFileName, String newFileName) {
//        return currentFileName == null || currentFileName.isEmpty() ||
//                currentTempFileName == null || currentTempFileName.isEmpty() ||
//                !currentTempFileName.equals(newFileName) ||
//                !currentFileName.equals(newFileName);
//    }
//
//    private boolean isMetadataDownload(Aria2StatusParam aria2Status) {
//        // Check if this is a metadata download for magnet links
//        // Metadata downloads typically have very small totalLength and no files
//        Long totalLength = aria2Status.getTotalLength();
//        boolean hasFiles = aria2Status.getFiles() != null && !aria2Status.getFiles().isEmpty();
//
//        return totalLength != null && totalLength < 1024 * 1024 && !hasFiles; // Less than 1MB and no files
//    }
//
//    private double calculateProgressPercentage(long completed, long total) {
//        if (total > 0) {
//            return Math.round(((double) completed / total) * 100 * 100.0) / 100.0;
//        }
//        return 0.0;
//    }
//
//    private String formatSpeed(long bytesPerSecond) {
//        if (bytesPerSecond < 1024) {
//            return bytesPerSecond + " B/s";
//        } else if (bytesPerSecond < 1024 * 1024) {
//            return String.format("%.1f KB/s", bytesPerSecond / 1024.0);
//        } else {
//            return String.format("%.1f MB/s", bytesPerSecond / (1024.0 * 1024.0));
//        }
//    }
//}