package com.db.dbworld.app.cinema.catalog.tags.strategy.impl;

import com.db.dbworld.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

/**
 * Top 10 records by TMDB popularity.
 */
@Component
public class Top10TagStrategy implements TagStrategy {

    @Override
    public RecordTagType tagType() {
        return RecordTagType.TOP_10;
    }

    @Override
    public int priority() {
        return 100;
    }

    @Override
    public String selectSql() {
        return """
                SELECT r.id
                FROM records r
                JOIN tmdb_data t ON r.tmdb_id = t.id
                ORDER BY t.popularity DESC
                LIMIT 10
                """;
    }
}
