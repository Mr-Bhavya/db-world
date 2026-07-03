package com.db.dbworld.app.media.delete;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * Per-step outcome of a media-file deletion so the API can report the truth
 * instead of a blanket "success" that hides a failed filesystem step.
 *
 * {@code physicalFileDeleted} is null when file removal wasn't requested
 * (keep-the-file / "remove from library" mode).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MediaFileDeleteResult(
        String fileId,
        String filePath,
        Boolean physicalFileDeleted,
        boolean symlinkRemoved,
        boolean dbRecordDeleted,
        boolean found,
        List<String> warnings
) {
    public static MediaFileDeleteResult notFound(String id) {
        return new MediaFileDeleteResult(id, null, null, false, false, false,
                List.of("Media file not found"));
    }

    /** Fully clean iff the DB row (the source of truth) was removed and nothing warned. */
    public boolean clean() {
        return dbRecordDeleted && (warnings == null || warnings.isEmpty());
    }
}
