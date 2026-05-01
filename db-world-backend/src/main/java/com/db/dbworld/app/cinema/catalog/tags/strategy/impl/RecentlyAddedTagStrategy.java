package com.db.dbworld.app.cinema.catalog.tags.strategy.impl;

import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

/**
 * Records added to the catalog within the last 30 days.
 *
 * <h3>Score</h3>
 * {@code score = 30 - days_since_creation} — newest records score 30, a record
 * added exactly 30 days ago scores 0.  Stored in {@code record_tags.priority} so
 * rails sorted by {@code tagPriority} produce the same ordering as {@code createdAt DESC}.
 *
 * <p>The TagDefinition default sort for this tag is {@code createdAt DESC} (sub-second
 * precision), which is preferred when exact within-day ordering matters.
 */
@Component
public class RecentlyAddedTagStrategy implements TagStrategy {

    private static final int WINDOW_DAYS = 30;

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
                WHERE r.created_at >= NOW() - INTERVAL %d DAY
                """.formatted(WINDOW_DAYS);
    }

    /**
     * Assigns a score so newer records sort higher.
     * Records added today → 30; records added 30 days ago → 0.
     */
    @Override
    public String selectSqlWithScore() {
        return """
                SELECT r.id,
                    GREATEST(0, %d - DATEDIFF(CURDATE(), DATE(r.created_at))) AS score
                FROM records r
                WHERE r.created_at >= NOW() - INTERVAL %d DAY
                """.formatted(WINDOW_DAYS, WINDOW_DAYS);
    }
}
