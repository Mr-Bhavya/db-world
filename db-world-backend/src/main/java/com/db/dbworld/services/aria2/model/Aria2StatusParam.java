package com.db.dbworld.services.aria2.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Aria2StatusParam {
    // Common fields for both notifications and RPC responses
    private String jsonrpc = "2.0";
    private String id;
    private String method; // For notifications (aria2.onDownloadStart, etc.)

    // Download status fields
    private String gid;
    private String status; // active, waiting, paused, error, complete, removed
    private Long totalLength;
    private Long completedLength;
    private Long uploadLength;
    private String bitfield;
    private Long downloadSpeed;
    private Long uploadSpeed;
    private Integer connections;
    private String infoHash;
    private Integer numSeeders;
    private Boolean seeder;
    private Long pieceLength;
    private Integer numPieces;
    private Integer errorCode;
    private String errorMessage;
    private List<String> followedBy;
    private String following;
    private List<String> belongsTo;
    private String dir;
    private List<Aria2File> files;
    private Aria2Bittorrent bittorrent;

    @JsonIgnore
    private String completedDateTime;

    // Notification specific fields (from Aria2NotificationParams)
    private Integer filesCount; // Equivalent to 'files' in notification params
    private Map<String, Object> additionalProperties;

    // RPC response specific
    private Object result; // For RPC responses
    private Aria2RpcError error; // For errors

    // Helper methods to determine message type
    public boolean isNotification() {
        return method != null && method.startsWith("aria2.on");
    }

    public boolean isRpcResponse() {
        return result != null || (error != null && method == null);
    }

    public boolean hasError() {
        return error != null || "error".equals(status);
    }

    public boolean isActive() {
        return "active".equals(status);
    }

    public boolean isComplete() {
        return "complete".equals(status);
    }

    public boolean isError() {
        return "error".equals(status);
    }

    public boolean isPaused() {
        return "paused".equals(status);
    }

    public boolean hasFiles() {
        return (files != null && !files.isEmpty()) || (filesCount != null && filesCount > 0);
    }

    public boolean hasBittorrentInfo() {
        return bittorrent != null;
    }

    public boolean isMetadataDownload() {
        // Extract first file path safely
        String path = (this.files != null && !this.files.isEmpty())
                ? this.files.get(0).getPath()
                : "";

        boolean isSmallSize = this.totalLength > 0 && this.totalLength < 500 * 1024; // < 500 KB
        boolean hasFollowedBy = (this.followedBy != null && !this.followedBy.isEmpty());
        boolean isMetadataFile = path.startsWith("[METADATA]");

        return hasBittorrentInfo() && (isSmallSize || hasFollowedBy || isMetadataFile);
    }


    public Double getProgressPercentage() {
        if (totalLength != null && totalLength > 0 && completedLength != null) {
            return Math.round(((double) completedLength / totalLength) * 100 * 100.0) / 100.0;
        }
        return 0.0;
    }

    public String getFormattedSpeed() {
        if (downloadSpeed == null) return "0 B/s";

        long bytesPerSecond = downloadSpeed;
        if (bytesPerSecond < 1024) {
            return bytesPerSecond + " B/s";
        } else if (bytesPerSecond < 1024 * 1024) {
            return String.format("%.1f KB/s", bytesPerSecond / 1024.0);
        } else {
            return String.format("%.1f MB/s", bytesPerSecond / (1024.0 * 1024.0));
        }
    }

    public Long calculateEta() {
        if (downloadSpeed != null && downloadSpeed > 0 &&
                totalLength != null && completedLength != null &&
                totalLength > completedLength) {
            long remainingBytes = totalLength - completedLength;
            return remainingBytes / downloadSpeed;
        }
        return 0L;
    }

    // Factory methods for common scenarios
    public static Aria2StatusParam createFromNotification(String method, String gid) {
        Aria2StatusParam status = new Aria2StatusParam();
        status.setMethod(method);
        status.setGid(gid);
        return status;
    }

    public static Aria2StatusParam createFromRpcResponse(String gid, String status) {
        Aria2StatusParam downloadStatus = new Aria2StatusParam();
        downloadStatus.setGid(gid);
        downloadStatus.setStatus(status);
        return downloadStatus;
    }

    public static Aria2StatusParam createError(String gid, String errorMessage, Integer errorCode) {
        Aria2StatusParam status = new Aria2StatusParam();
        status.setGid(gid);
        status.setStatus("error");
        status.setErrorMessage(errorMessage);
        status.setErrorCode(errorCode);
        return status;
    }
}
