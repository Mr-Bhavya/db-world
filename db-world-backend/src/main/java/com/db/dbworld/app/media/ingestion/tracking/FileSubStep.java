package com.db.dbworld.app.media.ingestion.tracking;

/**
 * Per-file processing sub-steps surfaced in the ingestion progress breakdown.
 * A single job (e.g. a season pack) processes multiple files sequentially, and
 * each file moves through these stages.
 */
public enum FileSubStep {
    FFMPEG,
    MEDIA_INFO,
    STORYBOARD
}
