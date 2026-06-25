package com.db.dbworld.app.cinema.catalog.tags.strategy.impl;

import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

/**
 * TV records that gained a brand-new season within the last {@value #WINDOW_DAYS} days.
 *
 * <p>Driven by {@code records.new_content_at} / {@code new_content_kind}, which are set at
 * ingest only when a genuinely new season is added (not on re-uploads / quality variants).
 * This is what lets an old show resurface on the home rail when a new season drops, regardless
 * of its trending score. The 30-day SQL window self-expires — the scheduler drops stale tags.
 */
@Component
public class NewSeasonTagStrategy implements TagStrategy {

    private static final int WINDOW_DAYS = 30;

    @Override
    public RecordTagType tagType() {
        return RecordTagType.NEW_SEASON;
    }

    @Override
    public int priority() {
        return 35;
    }

    @Override
    public String selectSql() {
        return """
                SELECT r.id
                FROM records r
                WHERE r.type = 'TV_SERIES'
                  AND r.new_content_kind = 'NEW_SEASON'
                  AND r.new_content_at >= NOW() - INTERVAL %d DAY
                """.formatted(WINDOW_DAYS);
    }

    /** Newer additions score higher so the rail orders newest-first via tagPriority. */
    @Override
    public String selectSqlWithScore() {
        return """
                SELECT r.id,
                    GREATEST(1, %d - DATEDIFF(CURDATE(), DATE(r.new_content_at))) AS score
                FROM records r
                WHERE r.type = 'TV_SERIES'
                  AND r.new_content_kind = 'NEW_SEASON'
                  AND r.new_content_at >= NOW() - INTERVAL %d DAY
                """.formatted(WINDOW_DAYS, WINDOW_DAYS);
    }
}
