package com.db.dbworld.payloads.mirror.ytdlp;

import lombok.Data;

import java.time.Duration;

// Response DTO (if needed)
@Data
public class YoutubeDownloadResponse {
    private String downloadedFilePath;
    private long fileSize;
    private Duration downloadDuration;
    private boolean success;
    private String errorMessage;
}
