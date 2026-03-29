package com.db.dbworld.app.media.ingestion.enums;

/**
 * Classifies where a download originates from.
 * Determines which DownloadStrategy handles the job.
 *
 * YOUTUBE  → YtDlpDownloadStrategy  (no GID, no pause/resume support)
 * HTTP     → Aria2DownloadStrategy  (has GID, supports pause/resume)
 * TORRENT  → Aria2DownloadStrategy  (has GID, supports pause/resume)
 * UNKNOWN  → no matching strategy → job fails at source-resolution stage
 */
public enum SourceType {
    YOUTUBE,
    HTTP,
    TORRENT,
    UNKNOWN
}
