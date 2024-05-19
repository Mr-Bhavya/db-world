package com.db.dbworld.services.Impl;

import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.StatusService;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.Map;

@Log4j2
@Service
public class StatusServiceImpl implements StatusService {

    @Override
    public Map<String, MirrorStatus> getAllStatus() {
        return cacheMirrorStatus;
    }

    @Override
    public MirrorStatus getStatusById(String id) {
        return cacheMirrorStatus.get(id);
    }

    @Override
    public void addNewStatus(MirrorStatus mirrorStatus) {
        cacheMirrorStatus.put(mirrorStatus.getId(), mirrorStatus);
    }

    @Override
    public void deleteStatus(String id) {
        cacheMirrorStatus.remove(id);
    }

    @Override
    public void updateStatus(MirrorStatus mirrorStatus){
        mirrorStatus.setTimeStamp(String.valueOf(new Date().getTime()));
        cacheMirrorStatus.replace(mirrorStatus.getId(), mirrorStatus);
    }

    @Override
    public void updateMirrorStatusWithFileSize(String id, Long fileSize) {
        MirrorStatus mirrorStatus = getStatusById(id);
        mirrorStatus.setFileSize(fileSize);
        updateStatus(mirrorStatus);
    }

    @Override
    public void updateMirrorStatusWithDownloadState(String id, MirrorStatus.DownloadStatus downloadStatus) {
        MirrorStatus mirrorStatus = getStatusById(id);
        mirrorStatus.setCurrentStatus("Downloading...");
        mirrorStatus.setDownloadStatus(downloadStatus);updateStatus(mirrorStatus);
    }

    @Override
    public void updateMirrorStatusWithExtracting(String id) {
        MirrorStatus mirrorStatus = getStatusById(id);
        mirrorStatus.setCurrentStatus("Extracting...");
        updateStatus(mirrorStatus);
        log.info("Extracting File: {}", mirrorStatus.getFileName());
    }

    @Override
    public void updateMirrorStatusWithSuccess(String id) {
        MirrorStatus mirrorStatus = getStatusById(id);
        mirrorStatus.setCurrentStatus("Completed ✅");
        mirrorStatus.setSuccess(true);
        mirrorStatus.setCompleted(true);
        updateStatus(mirrorStatus);
        log.info("Task '{}' is  Success. FileName: {}", mirrorStatus.getId(), mirrorStatus.getFileName());
    }

    @Override
    public void updateMirrorStatusWithFailed(String id, String message) {
        MirrorStatus mirrorStatus = getStatusById(id);
        mirrorStatus.setCurrentStatus("Failed ❌");
        mirrorStatus.setFailed(true);
        mirrorStatus.setCompleted(true);
        updateStatus(mirrorStatus);
        log.info("Task '{}' is failed. Filename: {}, Error Message: {}", mirrorStatus.getId(), mirrorStatus.getFileName(), message);
    }

    @Override
    public void updateMirrorStatusWithCancelled(String id) {
        MirrorStatus mirrorStatus = getStatusById(id);
        mirrorStatus.setCurrentStatus("Cancelled 🚮");
        mirrorStatus.setCancelled(true);
        mirrorStatus.setCompleted(true);
        updateStatus(mirrorStatus);
        log.info("Task '{}' is cancelled. Filename: {}", mirrorStatus.getId(), mirrorStatus.getFileName());
    }
}
