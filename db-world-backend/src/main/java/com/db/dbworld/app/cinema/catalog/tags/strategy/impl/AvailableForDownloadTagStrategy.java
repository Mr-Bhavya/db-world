package com.db.dbworld.app.cinema.catalog.tags.strategy.impl;

import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

/**
 * Marks records that have at least one associated media file available for download.
 * Queries the media_files table directly — no TMDB join needed.
 *
 * <p>Membership is binary (a record either has files or it doesn't), so every row gets the same
 * flat score. Rails on this tag sort by {@code createdAt} rather than {@code tagPriority}.
 */
@Component
public class AvailableForDownloadTagStrategy implements TagStrategy {

    /** Flat score — there is nothing to rank here, so all rows tie. */
    private static final int SCORE = 50;

    @Override
    public RecordTagType tagType() {
        return RecordTagType.AVAILABLE_FOR_DOWNLOAD;
    }

    @Override
    public String selectSql() {
        return """
                SELECT DISTINCT mf.record_id AS id, %d AS score
                FROM db_world.media_files mf
                WHERE mf.record_id IS NOT NULL
                """.formatted(SCORE);
    }
}
