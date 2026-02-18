package com.db.dbworld.payloads.mirror.ytdlp;

import lombok.Builder;
import lombok.Data;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

// Request DTO
@Data
@Builder
public class YoutubeDownloadRequest {
    private String videoUrl;
    private String outputPath;
    private String videoITag;
    private String audioITag;
    private Consumer<String> outputProcessor;
    private Consumer<String> errorProcessor;
    private AtomicBoolean cancellationFlag;
    private Duration timeout;

    public static class YoutubeDownloadRequestBuilder {
        // Default values
        private Duration timeout = Duration.ofMinutes(30);
    }
}

