package com.db.dbworld.services.mirror;

import com.db.dbworld.payloads.MirrorStatus;
import com.google.gson.JsonObject;
import org.springframework.scheduling.annotation.Async;

public interface UtilsService {

    @Async
    void downloadFileUsingAria2c(MirrorStatus mirrorStatus);

    JsonObject getInfoYtFile(String url);

    void downloadYtFile(MirrorStatus mirrorStatus);

    void deleteTempFiles();
}
