package com.db.dbworld.services.mirror.impl;

import com.codahale.metrics.Meter;
import com.codahale.metrics.MetricRegistry;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.mirror.StatusService;
import com.db.dbworld.stream.processor.StreamLogger;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Consumer;

@Log4j2
@Service
public class StatusServiceImpl implements StatusService {

    // Thread-safe maps for status storage
    private final ConcurrentMap<String, MirrorStatus> statusMap = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, String> gidToIdMap = new ConcurrentHashMap<>();

    // Metrics setup
    private static final MetricRegistry METRIC_REGISTRY = new MetricRegistry();
    private static final Meter DOWNLOAD_METER = METRIC_REGISTRY.meter("download-speed");

    @Override
    public Map<String, MirrorStatus> getAllStatus() {
        return Map.copyOf(statusMap); // Return immutable copy
    }

    @Override
    public MirrorStatus getStatusById(String id) {
        return Optional.ofNullable(statusMap.get(id))
                .orElseGet(MirrorStatus::new);
    }

    @Override
    public MirrorStatus getMirrorStatusByGid(String gid) {
        return Optional.ofNullable(gidToIdMap.get(gid))
                .map(this::getStatusById)
                .orElseGet(MirrorStatus::new);
    }

    @Override
    public void addNewStatus(MirrorStatus mirrorStatus) {
        if (mirrorStatus != null && mirrorStatus.getId() != null) {
            statusMap.put(mirrorStatus.getId(), mirrorStatus);
            if (mirrorStatus.getGid() != null) {
                gidToIdMap.put(mirrorStatus.getGid(), mirrorStatus.getId());
            }
        }
    }

    @Override
    public void deleteStatus(String id) {
        Optional.ofNullable(statusMap.remove(id))
                .ifPresent(status -> {
                    if (status.getGid() != null) {
                        gidToIdMap.remove(status.getGid());
                    }
                });
    }

    @Override
    public void updateStatus(MirrorStatus mirrorStatus) {
        if (mirrorStatus != null && mirrorStatus.getId() != null) {
            mirrorStatus.setTimeStamp(String.valueOf(System.currentTimeMillis()));
            statusMap.compute(mirrorStatus.getId(), (k, v) -> {
                if (v != null && v.getGid() != null && !v.getGid().equals(mirrorStatus.getGid())) {
                    gidToIdMap.remove(v.getGid());
                }
                if (mirrorStatus.getGid() != null) {
                    gidToIdMap.put(mirrorStatus.getGid(), mirrorStatus.getId());
                }
                return mirrorStatus;
            });
        }
    }

    // Helper method for common update patterns
    private void updateStatus(String id, Consumer<MirrorStatus> updater) {
        Optional.ofNullable(statusMap.get(id))
                .ifPresent(status -> {
                    updater.accept(status);
                    updateStatus(status);
                });
    }

    @Override
    public void updateMirrorStatusWithFileSize(String id, Long fileSize) {
        updateStatus(id, status -> status.setFileSize(fileSize));
    }

    @Override
    public void updateStatusMessage(String id, String message) {
        updateStatus(id, status -> status.setMessage(message));
    }

    @Override
    public void updateMirrorStatusWithDownloadState(String id, MirrorStatus.DownloadStatus newDownloadStatus) {
        updateStatus(id, status -> {
            status.setDownloadStatus(newDownloadStatus);
            status.setCurrentStatus("Downloading...");
        });
    }

    @Override
    public void updateMirrorStatusWithNewDownloadBytes(String id, long newBytes) {
        updateStatus(id, status -> {
            MirrorStatus.DownloadStatus previousStatus = status.getDownloadStatus();
            long previousDownloaded = (previousStatus != null) ? previousStatus.getFileDownloaded() : 0;
            long newDownloaded = previousDownloaded + newBytes;

            if (newBytes > 0) {
                DOWNLOAD_METER.mark(newBytes);
            }

            double speed = DOWNLOAD_METER.getOneMinuteRate();
            long totalFileSize = status.getFileSize();
            long remaining = totalFileSize - newDownloaded;
            long eta = (speed > 0 && remaining > 0) ? (long) (remaining / speed) : 0;

            MirrorStatus.DownloadStatus newStatus = new MirrorStatus.DownloadStatus();
            newStatus.setFileDownloaded(newDownloaded);
            newStatus.setSpeed(speed);
            newStatus.setUpdateTime(System.currentTimeMillis());
            newStatus.setTotalFileSize(totalFileSize);
            newStatus.setEta(eta);
            newStatus.setFileRemaining(remaining);

            status.setDownloadStatus(newStatus);
            status.setCurrentStatus("Downloading...");
        });
    }

    @Override
    public void updateMirrorStatusWithExtracting(String id) {
        updateStatus(id, status -> {
            status.setCurrentStatus("Extracting...");
            log.info("Extracting File: \"{}\" ===> \"{}\"",
                    status.getTempFilePath(), status.getTempExtractedFilePath());
        });
    }

    @Override
    public void updateMirrorStatusWithSuccess(String id) {
        updateStatus(id, status -> {
            status.setCurrentStatus("Completed ✅");
            status.setSuccess(true);
            status.setCompleted(true);
            log.info("Task '{}' is Success. FileName: {}", status.getId(), status.getFileName());
        });
    }

    @Override
    public void updateMirrorStatusWithFailed(String id, String message) {
        updateStatus(id, status -> {
            status.setCurrentStatus("Failed ❌");
            status.setFailed(true);
            status.setCompleted(true);
//            status.setMessage(message);
            log.error("Task '{}' failed. Filename: {}, Error Message: {}",
                    status.getId(), status.getFileName(), message);
        });
    }

    @Override
    public void updateMirrorStatusWithCancelled(String id) {
        updateStatus(id, status -> {
            status.setCurrentStatus("Cancelled 🚮");
            status.setCancelled(true);
            status.setCompleted(true);
            log.warn("Task '{}' is cancelled. Filename: {}", status.getId(), status.getFileName());
        });
    }

    @Override
    public void updateMirrorStatusWithPause(String id) {
        updateStatus(id, status -> {
            status.setCurrentStatus("Paused ⏸");
            status.setPause(true);
            log.info("Task '{}' is paused. Filename: {}", status.getId(), status.getFileName());
        });
    }

    @Override
    public void updateMirrorStatusWithResume(String id) {
        updateStatus(id, status -> {
            status.setCurrentStatus("Resumed ▶");
            status.setPause(false);
            log.info("Task '{}' is resumed. Filename: {}", status.getId(), status.getFileName());
        });
    }

    @Override
    public void logAndAppendHtml(MirrorStatus mirrorStatus, String message, boolean isError) {
        if (mirrorStatus != null) {
            StreamLogger.appendHtmlLine(mirrorStatus, message, isError, this);
        }
        if (isError) {
            log.error(message);
        } else {
            log.info(message);
        }
    }
}