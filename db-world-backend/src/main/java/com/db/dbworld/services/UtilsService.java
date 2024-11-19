package com.db.dbworld.services;

import com.db.dbworld.payloads.MirrorStatus;
import com.google.gson.JsonObject;
import org.springframework.http.HttpHeaders;

import java.io.IOException;

public interface UtilsService {
    void downloadHttpFile(MirrorStatus mirrorStatus);
    void downloadHttpFile_1(MirrorStatus mirrorStatus);
    void downloadMagnetFile(MirrorStatus mirrorStatus);
    void extract(String mirrorId, String sourcePath, String targetPath, String password) throws IOException;
    JsonObject getInfoYtFile(String url);
    void downloadYtFile(MirrorStatus mirrorStatus);
    void deleteTempFiles();
    HttpHeaders getHeaders(String url);
}
