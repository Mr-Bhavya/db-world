package com.db.dbworld.services.Impl;

import com.codahale.metrics.Meter;
import com.codahale.metrics.MetricRegistry;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.StatusService;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Log4j2
@Service
public class StatusServiceImpl implements StatusService {

    // Using a thread-safe in-memory map instead of Redis.
    private final Map<String, MirrorStatus> statusMap = new ConcurrentHashMap<>();

    private static final MetricRegistry metricRegistry = new MetricRegistry();
    private static final Meter meter = metricRegistry.meter("download-speed");

    @Override
    public Map<String, MirrorStatus> getAllStatus() {
        return statusMap;
    }

    @Override
    public MirrorStatus getStatusById(String id) {
        return statusMap.get(id);
    }

    @Override
    public void addNewStatus(MirrorStatus mirrorStatus) {
        statusMap.put(mirrorStatus.getId(), mirrorStatus);
    }

    @Override
    public void deleteStatus(String id) {
        statusMap.remove(id);
    }

    @Override
    public void updateStatus(MirrorStatus mirrorStatus) {
        // Update timestamp using system current time in millis.
        mirrorStatus.setTimeStamp(String.valueOf(System.currentTimeMillis()));
        statusMap.put(mirrorStatus.getId(), mirrorStatus);
    }

    @Override
    public void updateMirrorStatusWithFileSize(String id, Long fileSize) {
        MirrorStatus mirrorStatus = getStatusById(id);
        if (mirrorStatus != null) {
            mirrorStatus.setFileSize(fileSize);
            updateStatus(mirrorStatus);
        }
    }

    @Override
    public void updateStatusMessage(String id, String message) {
        MirrorStatus mirrorStatus = getStatusById(id);
        if (mirrorStatus != null) {
            mirrorStatus.setMessage(message);
            updateStatus(mirrorStatus);
        }
    }

    @Override
    public void updateMirrorStatusWithDownloadState(String id, long newBytes) {
        MirrorStatus mirrorStatus = getStatusById(id);
        if (mirrorStatus != null) {
            // Retrieve previous download status; if null, assume 0 bytes downloaded.
            MirrorStatus.DownloadStatus previousStatus = mirrorStatus.getDownloadStatus();
            long previousDownloaded = (previousStatus != null) ? previousStatus.getFileDownloaded() : 0;
            long newDownloaded = previousDownloaded + newBytes;

            // Record the new bytes downloaded.
            if (newBytes > 0) {
                meter.mark(newBytes);
            }
            double speed = meter.getOneMinuteRate(); // Bytes per second
            long totalFileSize = mirrorStatus.getFileSize();
            long remaining = totalFileSize - newDownloaded;
            long eta = (speed > 0 && remaining > 0) ? (long) (remaining / speed) : 0; // In seconds

            // Build new download status
            MirrorStatus.DownloadStatus newStatus = new MirrorStatus.DownloadStatus();
            newStatus.setFileDownloaded(newDownloaded);
            newStatus.setSpeed(speed);
            newStatus.setUpdateTime(System.currentTimeMillis());
            newStatus.setTotalFileSize(totalFileSize);
            newStatus.setEta(eta);
            newStatus.setFileRemaining(remaining);

            mirrorStatus.setDownloadStatus(newStatus);
            mirrorStatus.setCurrentStatus("Downloading...");
            updateStatus(mirrorStatus);
        }
    }

    @Override
    public void updateMirrorStatusWithExtracting(String id) {
        MirrorStatus mirrorStatus = getStatusById(id);
        if (mirrorStatus != null) {
            mirrorStatus.setCurrentStatus("Extracting...");
            updateStatus(mirrorStatus);
            log.info("Extracting File: \"{}\" ===> \"{}\"",
                    mirrorStatus.getTempFilePath(), mirrorStatus.getTempExtractedFilePath());
        }
    }

    @Override
    public void updateMirrorStatusWithSuccess(String id) {
        MirrorStatus mirrorStatus = getStatusById(id);
        if (mirrorStatus != null) {
            mirrorStatus.setCurrentStatus("Completed ✅");
            mirrorStatus.setSuccess(true);
            mirrorStatus.setCompleted(true);
            updateStatus(mirrorStatus);
            log.info("Task '{}' is Success. FileName: {}", mirrorStatus.getId(), mirrorStatus.getFileName());
        }
    }

    @Override
    public void updateMirrorStatusWithFailed(String id, String message) {
        MirrorStatus mirrorStatus = getStatusById(id);
        if (mirrorStatus != null) {
            mirrorStatus.setCurrentStatus("Failed ❌");
            mirrorStatus.setFailed(true);
            mirrorStatus.setCompleted(true);
            mirrorStatus.setMessage(message);
            updateStatus(mirrorStatus);
            log.info("Task '{}' failed. Filename: {}, Error Message: {}",
                    mirrorStatus.getId(), mirrorStatus.getFileName(), message);
        }
    }

    @Override
    public void updateMirrorStatusWithCancelled(String id) {
        MirrorStatus mirrorStatus = getStatusById(id);
        if (mirrorStatus != null) {
            mirrorStatus.setCurrentStatus("Cancelled 🚮");
            mirrorStatus.setCancelled(true);
            mirrorStatus.setCompleted(true);
            updateStatus(mirrorStatus);
            log.info("Task '{}' is cancelled. Filename: {}", mirrorStatus.getId(), mirrorStatus.getFileName());
        }
    }

    @Override
    public void updateMirrorStatusWithPause(String id) {
        MirrorStatus mirrorStatus = getStatusById(id);
        if (mirrorStatus != null) {
            mirrorStatus.setCurrentStatus("Paused");
            mirrorStatus.setPause(true);
            updateStatus(mirrorStatus);
            log.info("Task '{}' is paused. Filename: {}", mirrorStatus.getId(), mirrorStatus.getFileName());
        }
    }

    @Override
    public void updateMirrorStatusWithResume(String id) {
        MirrorStatus mirrorStatus = getStatusById(id);
        if (mirrorStatus != null) {
            mirrorStatus.setCurrentStatus("Resume");
            mirrorStatus.setPause(false);
            updateStatus(mirrorStatus);
            log.info("Task '{}' is resumed. Filename: {}", mirrorStatus.getId(), mirrorStatus.getFileName());
        }
    }
}
