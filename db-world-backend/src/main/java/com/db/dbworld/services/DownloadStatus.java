package com.db.dbworld.services;

import lombok.Data;
import java.time.Instant;

@Data
public class DownloadStatus {
    private String downloadId;
    private String userId;
    private String fileName;
    private String filePath;
    private long fileSize;
    private long bytesTransferred;
    private long bytesSent;
    private double duration;
    private DownloadType type;
    private boolean started;
    private boolean completed;
    private Instant lastSeen;
    private String remoteAddr;
    private String userAgent;
    private String rangeStart;
    private String status;
    private String statusCode;

    public enum DownloadType {
        STREAM,
        DOWNLOAD;

        public static DownloadType determineType(String eventType, long fileSize,
                                                 long bytesTransferred, double duration) {
            if ("COMPLETE".equals(eventType)) {
                return DOWNLOAD;
            }

            // High transfer rate suggests streaming
            if (duration > 0 && bytesTransferred > 0) {
                double transferRate = bytesTransferred / duration;
                if (transferRate > 5_000_000) { // >5MB/s
                    return STREAM;
                }
            }

            return DOWNLOAD;
        }
    }

    public double getCompletionPercentage() {
        if (fileSize <= 0) return 0;
        return (double) bytesTransferred / fileSize * 100;
    }

    public double getTransferSpeed() {
        if (duration <= 0) return 0;
        return bytesSent / duration; // bytes per second
    }
}