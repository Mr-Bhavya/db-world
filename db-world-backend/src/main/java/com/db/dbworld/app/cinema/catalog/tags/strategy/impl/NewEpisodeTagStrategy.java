package com.db.dbworld.app.cinema.catalog.tags.strategy.impl;

import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

/**
 * TV records that gained a new episode within the last {@value #WINDOW_DAYS} days.
 *
 * <p>Counterpart to {@link NewSeasonTagStrategy}. A record carries at most one of the two
 * new-content tags at a time (driven by the single-valued {@code new_content_kind}), so the
 * combined "New Episodes & Seasons" rail can union them without duplicates.
 */
@Component
public class NewEpisodeTagStrategy implements TagStrategy {

    private static final int WINDOW_DAYS = 30;

    @Override
    public RecordTagType tagType() {
        return RecordTagType.NEW_EPISODE;
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
                  AND r.new_content_kind = 'NEW_EPISODE'
                  AND r.new_content_at >= NOW() - INTERVAL %d DAY
                """.formatted(WINDOW_DAYS);
    }

    @Override
    public String selectSqlWithScore() {
        return """
                SELECT r.id,
                    GREATEST(1, %d - DATEDIFF(CURDATE(), DATE(r.new_content_at))) AS score
                FROM records r
                WHERE r.type = 'TV_SERIES'
                  AND r.new_content_kind = 'NEW_EPISODE'
                  AND r.new_content_at >= NOW() - INTERVAL %d DAY
                """.formatted(WINDOW_DAYS, WINDOW_DAYS);
    }
}
