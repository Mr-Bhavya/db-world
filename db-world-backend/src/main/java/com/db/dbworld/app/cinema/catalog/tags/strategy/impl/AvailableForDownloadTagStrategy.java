package com.db.dbworld.app.cinema.catalog.tags.strategy.impl;

import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

/**
 * Marks records that have at least one associated media file available for download.
 * Queries the media_files table directly — no TMDB join needed.
 */
@Component
public class AvailableForDownloadTagStrategy implements TagStrategy {

    @Override
    public RecordTagType tagType() {
        return RecordTagType.AVAILABLE_FOR_DOWNLOAD;
    }

    @Override
    public int priority() {
        return 50;
    }

    @Override
    public String selectSql() {
        return """
                SELECT DISTINCT mf.record_id AS id
                FROM new_db_world.media_files mf
                WHERE mf.record_id IS NOT NULL
                """;
    }
}
