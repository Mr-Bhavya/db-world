package com.db.dbworld.app.cinema.catalog.tags.strategy.impl;

import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

/**
 * Records with TMDB popularity >= 80.
 */
@Component
public class TrendingTagStrategy implements TagStrategy {

    @Override
    public RecordTagType tagType() {
        return RecordTagType.TRENDING;
    }

    @Override
    public int priority() {
        return 70;
    }

    @Override
    public String selectSql() {
        return """
                SELECT r.id
                FROM records r
                JOIN tmdb_data t ON r.tmdb_id = t.id
                WHERE t.popularity >= 80
                ORDER BY t.popularity DESC
                LIMIT 30
                """;
    }
}
