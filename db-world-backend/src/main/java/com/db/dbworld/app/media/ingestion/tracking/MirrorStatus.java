package com.db.dbworld.app.media.ingestion.tracking;

public enum MirrorStatus {
    QUEUED,
    STARTED,

    DOWNLOADING,

    /**
     * Download finished; the job is PARKED waiting for the admin to pick which audio/subtitle
     * tracks to keep (opt-in "review tracks" jobs only). It holds NO processing slot while it
     * waits, so other jobs keep downloading/processing. Resolves to PROCESSING on selection, or
     * on timeout (smart default applied) — or CANCELLED/FAILED.
     */
    AWAITING_INPUT,

    PROCESSING,

    PAUSED,

    COMPLETED,   // umbrella terminal
    SUCCESS,     // completed-success
    FAILED,      // completed-failed
    CANCELLED    // completed-cancelled
}
