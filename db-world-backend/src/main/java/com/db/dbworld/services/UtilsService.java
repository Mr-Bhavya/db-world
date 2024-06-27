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
    void deleteTempFiles();
    HttpHeaders getHeaders(String url);
}
