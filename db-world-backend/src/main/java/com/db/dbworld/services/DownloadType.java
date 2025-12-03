package com.db.dbworld.services;

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
