package com.db.dbworld.app.cinema.catalog.tags.strategy.impl;

import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

/**
 * Featured content: high-rated records (vote_average >= 7.5)
 * with decent popularity (>= 50) — Netflix "spotlight" style.
 */
@Component
public class FeaturedTagStrategy implements TagStrategy {

    @Override
    public RecordTagType tagType() {
        return RecordTagType.FEATURED;
    }

    @Override
    public int priority() {
        return 20;
    }

    @Override
    public String selectSql() {
        return """
                SELECT r.id
                FROM records r
                JOIN tmdb_data t ON r.tmdb_id = t.id
                WHERE t.vote_average >= 7.5
                  AND t.popularity >= 50
                ORDER BY t.vote_average DESC, t.popularity DESC
                LIMIT 50
                """;
    }
}
