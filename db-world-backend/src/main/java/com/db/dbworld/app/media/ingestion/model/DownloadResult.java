package com.db.dbworld.app.media.ingestion.model;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.nio.file.Path;

@Getter
@Setter
@NoArgsConstructor
public class DownloadResult {
    private String downloadId;
    private String gid;
    private Path filePath;
    private String fileName;
    private long size;
    private boolean success;
    private String errorMessage;

    public static DownloadResult success(String downloadId, Path filePath, String fileName, long size) {
        DownloadResult r = new DownloadResult();
        r.downloadId = downloadId;
        r.filePath = filePath;
        r.fileName = fileName;
        r.size = size;
        r.success = true;
        return r;
    }

    public static DownloadResult failure(String downloadId, String errorMessage) {
        DownloadResult r = new DownloadResult();
        r.downloadId = downloadId;
        r.success = false;
        r.errorMessage = errorMessage;
        return r;
    }
}
