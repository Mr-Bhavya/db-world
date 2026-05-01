package com.db.dbworld.app.media.ingestion.tracking;

public enum MirrorStatus {
    QUEUED,
    STARTED,

    DOWNLOADING,
    PROCESSING,

    PAUSED,

    COMPLETED,   // umbrella terminal
    SUCCESS,     // completed-success
    FAILED,      // completed-failed
    CANCELLED    // completed-cancelled
}
