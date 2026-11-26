package com.db.dbworld.app.media.ingestion.controller;

import com.db.dbworld.app.media.ingestion.tracking.MirrorStatus;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** Bulk operations on the live job list, each scoped to the statuses it may act on. */
enum IngestionBulkAction {
    CLEAR_FINISHED(EnumSet.of(MirrorStatus.SUCCESS, MirrorStatus.COMPLETED, MirrorStatus.FAILED, MirrorStatus.CANCELLED)),
    RETRY_FAILED(EnumSet.of(MirrorStatus.FAILED)),
    PAUSE_ALL(EnumSet.of(MirrorStatus.DOWNLOADING)),
    RESUME_ALL(EnumSet.of(MirrorStatus.PAUSED));

    private final Set<MirrorStatus> statuses;

    IngestionBulkAction(Set<MirrorStatus> statuses) { this.statuses = statuses; }

    /** Parses the URL form, e.g. {@code clear-finished}. */
    static Optional<IngestionBulkAction> fromPath(String path) {
        if (path == null) return Optional.empty();
        try {
            return Optional.of(valueOf(path.trim().replace('-', '_').toUpperCase(Locale.ROOT)));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    /** Job ids from a {@code TrackingService.getAll()} snapshot whose status this action applies to. */
    List<String> targets(Map<String, Object> liveJobs) {
        List<String> out = new ArrayList<>();
        if (liveJobs == null) return out;
        liveJobs.forEach((jobId, summary) -> {
            MirrorStatus status = statusOf(summary);
            if (status != null && statuses.contains(status)) out.add(jobId);
        });
        return out;
    }

    private static MirrorStatus statusOf(Object summary) {
        if (!(summary instanceof Map<?, ?> map)) return null;
        Object s = map.get("status");
        if (s instanceof MirrorStatus ms) return ms;
        if (s == null) return null;
        try {
            return MirrorStatus.valueOf(s.toString());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
