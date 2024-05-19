package com.db.dbworld.services;

import com.db.dbworld.payloads.MirrorStatus;
import com.google.gson.JsonObject;
import org.springframework.http.HttpHeaders;

public interface UtilsService {
    void downloadHttpFile(MirrorStatus mirrorStatus);
    void downloadMagnetFile(MirrorStatus mirrorStatus);
    void extract(String sourcePath, String targetPath, String password);
    JsonObject getInfoYtFile(String url);
    void downloadYtFile(MirrorStatus mirrorStatus);

//    void updateMirrorStatus(MirrorStatus mirrorStatus);
//    MirrorStatus getMirrorStatus(String id);
//    void deleteMirrorStatus(String id);
//    Map<String, MirrorStatus> getAllMirrorStatus();

    HttpHeaders getHeaders(String url);
}
