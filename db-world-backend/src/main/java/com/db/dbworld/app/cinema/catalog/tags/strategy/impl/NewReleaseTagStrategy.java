package com.db.dbworld.app.cinema.catalog.tags.strategy.impl;

import com.db.dbworld.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

/**
 * Records released within the last 30 days (movie release_date or TV first_air_date).
 */
@Component
public class NewReleaseTagStrategy implements TagStrategy {

    @Override
    public RecordTagType tagType() {
        return RecordTagType.NEW_RELEASE;
    }

    @Override
    public int priority() {
        return 60;
    }

    @Override
    public String selectSql() {
        return """
                SELECT r.id
                FROM records r
                JOIN tmdb_data t ON r.tmdb_id = t.id
                WHERE COALESCE(NULLIF(t.release_date, ''), NULLIF(t.first_air_date, ''))
                      >= CURRENT_DATE - INTERVAL 30 DAY
                """;
    }
}
