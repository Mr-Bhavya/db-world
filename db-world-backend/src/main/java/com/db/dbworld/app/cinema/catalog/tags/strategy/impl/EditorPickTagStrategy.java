package com.db.dbworld.app.cinema.catalog.tags.strategy.impl;

import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

/**
 * Editor's Pick: critically acclaimed content with high vote count
 * (vote_average >= 8.0 AND vote_count >= 1000).
 * These are the "quality" picks — popular AND well-reviewed.
 */
@Component
public class EditorPickTagStrategy implements TagStrategy {

    @Override
    public RecordTagType tagType() {
        return RecordTagType.EDITOR_PICK;
    }

    @Override
    public int priority() {
        return 30;
    }

    @Override
    public String selectSql() {
        return """
                SELECT r.id
                FROM records r
                JOIN tmdb_data t ON r.tmdb_id = t.id
                WHERE t.vote_average >= 8.0
                  AND t.vote_count >= 1000
                ORDER BY t.vote_average DESC
                LIMIT 30
                """;
    }
}
