package com.db.dbworld.app.media.ingestion.tracking;

public record ProgressSnapshot(
        long   downloadedBytes,
        long   totalBytes,
        double speed,
        long   eta,
        /** "downloading", "merging", "processing" — null means downloading */
        String phase
) {
    public static ProgressSnapshot downloading(long dl, long tot, double speed, long eta) {
        return new ProgressSnapshot(dl, tot, speed, eta, "downloading");
    }
    public static ProgressSnapshot merging() {
        return new ProgressSnapshot(0, 0, 0, 0, "merging");
    }
}
