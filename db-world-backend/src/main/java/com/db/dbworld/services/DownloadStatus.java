package com.db.dbworld.services;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class DownloadStatus {
    private String downloadId;
    private String userId;
    private String fileName;
    private DownloadType type;
    private boolean started;
    private boolean completed;
    private String lastSeen;

    public enum DownloadType {
        STREAM,
        DOWNLOAD;

        public static DownloadType fromString(String value) {
            if (value == null) return null;
            try {
                return DownloadType.valueOf(value.toUpperCase());
            } catch (IllegalArgumentException e) {
                return null;
            }
        }

        @Override
        public String toString() {
            return name();
        }
    }

    @Override
    public String toString() {
        return String.format("DownloadStatus[downloadId=%s, userId=%s, fileName=%s, type=%s, started=%s, completed=%s, lastSeen=%s]",
                downloadId, userId, fileName, type, started, completed, lastSeen);
    }
}
