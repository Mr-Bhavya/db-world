package com.db.dbworld.app.cinema.catalog.tags.strategy.impl;

import com.db.dbworld.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

/**
 * Hero/banner content: extremely popular and well-rated records
 * for the top carousel / hero section.
 */
@Component
public class ShowOnTopTagStrategy implements TagStrategy {

    @Override
    public RecordTagType tagType() {
        return RecordTagType.SHOW_ON_TOP;
    }

    @Override
    public int priority() {
        return 10;
    }

    @Override
    public String selectSql() {
        return """
                SELECT r.id
                FROM records r
                JOIN tmdb_data t ON r.tmdb_id = t.id
                WHERE t.popularity >= 100
                  AND t.vote_average >= 7.0
                ORDER BY t.popularity DESC
                LIMIT 20
                """;
    }
}
