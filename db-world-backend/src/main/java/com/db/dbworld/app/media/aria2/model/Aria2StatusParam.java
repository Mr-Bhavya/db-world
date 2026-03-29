package com.db.dbworld.app.media.aria2.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Aria2StatusParam {

    private String jsonrpc = "2.0";
    private String id;
    private String method;

    private String gid;
    private String status;
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

    private Integer filesCount;
    private Map<String, Object> additionalProperties;
    private Object result;
    private Aria2RpcError error;

    // ── Predicates ────────────────────────────────────────────────────────────

    public boolean isNotification()  { return method != null && method.startsWith("aria2.on"); }
    public boolean isRpcResponse()   { return result != null || (error != null && method == null); }
    public boolean hasError()        { return error != null || "error".equals(status); }
    public boolean isActive()        { return "active".equals(status); }
    public boolean isComplete()      { return "complete".equals(status); }
    public boolean isError()         { return "error".equals(status); }
    public boolean isPaused()        { return "paused".equals(status); }
    public boolean hasFiles()        { return (files != null && !files.isEmpty()) || (filesCount != null && filesCount > 0); }
    public boolean hasBittorrentInfo() { return bittorrent != null; }

    public boolean isMetadataDownload() {
        String path = (files != null && !files.isEmpty()) ? files.get(0).getPath() : "";
        boolean isSmallSize  = totalLength != null && totalLength > 0 && totalLength < 500 * 1024;
        boolean hasFollowedBy = followedBy != null && !followedBy.isEmpty();
        boolean isMetaFile   = path != null && path.startsWith("[METADATA]");
        return hasBittorrentInfo() && (isSmallSize || hasFollowedBy || isMetaFile);
    }

    public Double getProgressPercentage() {
        if (totalLength != null && totalLength > 0 && completedLength != null) {
            return Math.round(((double) completedLength / totalLength) * 100 * 100.0) / 100.0;
        }
        return 0.0;
    }

    public String getFormattedSpeed() {
        if (downloadSpeed == null) return "0 B/s";
        if (downloadSpeed < 1024) return downloadSpeed + " B/s";
        if (downloadSpeed < 1024 * 1024) return String.format("%.1f KB/s", downloadSpeed / 1024.0);
        return String.format("%.1f MB/s", downloadSpeed / (1024.0 * 1024.0));
    }

    public Long calculateEta() {
        if (downloadSpeed != null && downloadSpeed > 0
                && totalLength != null && completedLength != null
                && totalLength > completedLength) {
            return (totalLength - completedLength) / downloadSpeed;
        }
        return 0L;
    }

    // ── Factory helpers ───────────────────────────────────────────────────────

    public static Aria2StatusParam ofGid(String gid) {
        Aria2StatusParam p = new Aria2StatusParam();
        p.setGid(gid);
        return p;
    }

    public static Aria2StatusParam ofError(String gid, String message, Integer code) {
        Aria2StatusParam p = new Aria2StatusParam();
        p.setGid(gid);
        p.setStatus("error");
        p.setErrorMessage(message);
        p.setErrorCode(code);
        return p;
    }
}
