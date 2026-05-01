package com.db.dbworld.services.mirror;

import com.db.dbworld.payloads.MirrorState;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.aria2.model.Aria2StatusParam;

import java.util.HashMap;
import java.util.Map;

import java.util.Map;

/**
 * @deprecated Mirror state tracking superseded by
 * {@link com.db.dbworld.app.media.ingestion.tracking.TrackingService}.
 * Still used by MirrorStatusHandler (also deprecated) until removed.
 */
@Deprecated(forRemoval = true)
public interface StatusService {

    // Basic CRUD operations
    Map<String, MirrorStatus> getAllStatus();
    MirrorStatus getStatusById(String id);
    MirrorStatus getMirrorStatusByGid(String gid);
    void addNewStatus(MirrorStatus mirrorStatus);
    void deleteStatus(String id);
    void updateStatus(MirrorStatus mirrorStatus);

    // Thread-safe state management
    boolean updateMirrorState(String id, MirrorState newState);
    boolean updateMirrorState(String id, MirrorState newState, String message);
    boolean pauseMirrorStatus(String id);
    boolean resumeMirrorStatus(String id);
    boolean cancelMirrorStatus(String id);
    boolean completeMirrorStatus(String id);
    boolean failMirrorStatus(String id, String message);

    // Utility methods
    boolean isOperationAllowed(String id, MirrorState requestedState);
    Map<String, MirrorState> getAllCurrentStates();

    // Legacy methods for backward compatibility
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

    void logAndAppendHtml(MirrorStatus mirrorStatus, String message, boolean isError);

    void updateMirrorStatusFromAria2(MirrorStatus mirrorStatus, Aria2StatusParam aria2Status);
}
