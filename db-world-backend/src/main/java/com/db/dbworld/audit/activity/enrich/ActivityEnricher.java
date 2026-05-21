package com.db.dbworld.audit.activity.enrich;

import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Resolves {@code file_path} → ({@code media_file_id}, {@code record_id}) for the
 * activity tracker. Stays a thin wrapper so callers don't need to know about the
 * media_files schema.
 *
 * <p>Returns nulls when nothing matches — tracking should never fail because a file
 * isn't yet ingested or has been removed.
 */
@Component
@RequiredArgsConstructor
@Log4j2
public class ActivityEnricher {

    private final MediaFileRepository mediaFileRepository;

    public static record Enrichment(String mediaFileId, Long recordId) {
        public static final Enrichment EMPTY = new Enrichment(null, null);
    }

    public Enrichment resolve(String filePath) {
        if (filePath == null || filePath.isBlank()) return Enrichment.EMPTY;
        try {
            Optional<Object[]> row = mediaFileRepository.findIdAndRecordIdByFilePath(filePath);
            if (row.isEmpty()) return Enrichment.EMPTY;
            Object[] r = row.get();
            String mediaFileId = r[0] != null ? r[0].toString() : null;
            Long recordId = r[1] instanceof Number n ? n.longValue() : null;
            return new Enrichment(mediaFileId, recordId);
        } catch (Exception e) {
            // Enrichment is best-effort — never fail the tracking call.
            log.debug("ActivityEnricher: lookup failed for {} — {}", filePath, e.getMessage());
            return Enrichment.EMPTY;
        }
    }
}
