package com.db.dbworld.services.mirror;

import com.db.dbworld.payloads.MirrorStatus;

import java.util.HashMap;
import java.util.Map;

public interface StatusService {
    Map<String, MirrorStatus> cacheMirrorStatus = new HashMap<>();
    Map<String, MirrorStatus> getAllStatus();
    MirrorStatus getStatusById(String id);

    MirrorStatus getMirrorStatusByGid(String gid);

    void addNewStatus(MirrorStatus mirrorStatus);

    void deleteStatus(String id);

    void updateStatus(MirrorStatus mirrorStatus);

    void updateMirrorStatusWithFileSize(String id, Long fileSize);

    void updateStatusMessage(String id, String message);

    void updateMirrorStatusWithDownloadState(String id, MirrorStatus.DownloadStatus newDownloadStatus);

    void updateMirrorStatusWithNewDownloadBytes(String id, long newBytes);

    void updateMirrorStatusWithExtracting(String id);

    void updateMirrorStatusWithSuccess(String id);

    void updateMirrorStatusWithFailed(String id, String message);

    void updateMirrorStatusWithCancelled(String id);

    void updateMirrorStatusWithPause(String id);

    void updateMirrorStatusWithResume(String id);
}
