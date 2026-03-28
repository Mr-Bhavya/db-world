package com.db.dbworld.app.cinema.catalog.tags.strategy.impl;

import com.db.dbworld.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

/**
 * Records added to the catalog within the last 14 days.
 */
@Component
public class RecentlyAddedTagStrategy implements TagStrategy {

    @Override
    public RecordTagType tagType() {
        return RecordTagType.RECENTLY_ADDED;
    }

    @Override
    public int priority() {
        return 40;
    }

    @Override
    public String selectSql() {
        return """
                SELECT r.id
                FROM records r
                WHERE r.created_at >= NOW() - INTERVAL 14 DAY
                """;
    }
}
