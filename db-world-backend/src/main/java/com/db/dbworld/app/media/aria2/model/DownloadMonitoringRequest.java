package com.db.dbworld.app.media.aria2.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Represents a request to start WebSocket-based monitoring of an Aria2 download.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DownloadMonitoringRequest {
    /** Aria2 GID assigned to this download. */
    private String gid;
    /** Internal ingestion job ID (previously: mirrorId). */
    private String jobId;
}
