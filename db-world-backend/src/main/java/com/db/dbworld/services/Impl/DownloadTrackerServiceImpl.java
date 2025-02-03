package com.db.dbworld.services.Impl;

import lombok.Getter;
import lombok.Setter;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class DownloadTrackerServiceImpl {
    private final Map<String, DownloadStatus> downloadStatusMap = new HashMap<>();

    public void startDownload(String downloadId, String fileName, String userId, long fileSize) {
        DownloadStatus status = new DownloadStatus(downloadId, fileName, userId, fileSize);
        downloadStatusMap.put(downloadId, status);
        System.out.println("Download started: " + status);
    }

    public void updateDownloadProgress(String downloadId, long bytesDownloaded) {
        DownloadStatus status = downloadStatusMap.get(downloadId);
        if (status != null) {
            status.setBytesDownloaded(bytesDownloaded);
            if (bytesDownloaded >= status.getFileSize()) {
                status.setCompleted(true);
            }
        }
    }

    public void failDownload(String downloadId, String error) {
        DownloadStatus status = downloadStatusMap.get(downloadId);
        if (status != null) {
            status.setFailed(true);
            status.setError(error);
            System.out.println("Download failed: " + status);
        }
    }

    public void completeDownload(String downloadId) {
        DownloadStatus status = downloadStatusMap.get(downloadId);
        if (status != null) {
            status.setCompleted(true);
            System.out.println("Download Complete: " + status);
        }
    }

    public DownloadStatus getDownloadStatus(String downloadId) {
        return downloadStatusMap.get(downloadId);
    }

    public Map<String, DownloadStatus> getAllDownloadStatus(){
        return downloadStatusMap;
    }

    @Getter
    @Setter
    public static class DownloadStatus {
        private final String downloadId;
        private final String fileName;
        private final String userId;
        private final long fileSize;
        @Getter
        private long bytesDownloaded;
        @Setter
        private boolean completed;
        private boolean failed;
        private String error;

        public DownloadStatus(String downloadId, String fileName, String userId, long fileSize) {
            this.downloadId = downloadId;
            this.fileName = fileName;
            this.userId = userId;
            this.fileSize = fileSize;
        }

        public void addBytesDownloaded(long bytes) {
            this.bytesDownloaded += bytes;
        }

        @Override
        public String toString() {
            return "DownloadStatus{" +
                    "downloadId='" + downloadId + '\'' +
                    ", fileName='" + fileName + '\'' +
                    ", userId='" + userId + '\'' +
                    ", fileSize=" + fileSize +
                    ", bytesDownloaded=" + bytesDownloaded +
                    ", completed=" + completed +
                    ", failed=" + failed +
                    ", error='" + error + '\'' +
                    '}';
        }
    }
}
