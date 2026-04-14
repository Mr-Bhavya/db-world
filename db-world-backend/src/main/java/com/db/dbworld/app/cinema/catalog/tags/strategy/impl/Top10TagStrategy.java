package com.db.dbworld.app.cinema.catalog.tags.strategy.impl;

import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

/**
 * Bulk strategy for TOP_10 tags.
 *
 * <h3>Scoring formula</h3>
 * <pre>
 *   score = popularity * exp(-days_since_release / 60)
 * </pre>
 * A 60-day half-life means recently-released popular content rises while
 * older content gradually fades — without the aggressive churn of TRENDING.
 *
 * <h3>Pool size: 20</h3>
 * Tagging 20 records (not 10) guarantees that after record-type filtering
 * (MOVIES page → MOVIE only, SERIES page → TV_SERIES only) there are still
 * enough records to fill the rail.  The rail's limitSize=10 + sort by
 * tagPriority ensures the visible row always shows the right 10.
 *
 * <h3>Root cause of "sometimes not 10 records"</h3>
 * The old strategy used a hard {@code LIMIT 10} and only joined records
 * that had TMDB data with non-null popularity.  If a record lacked a
 * popularity value it was silently excluded, making the count drop below 10.
 * {@code COALESCE(t.popularity, 0)} and {@code WHERE t.popularity IS NOT NULL}
 * now make the filtering explicit.
 */
@Component
public class Top10TagStrategy implements TagStrategy {

    private static final int POOL_SIZE = 20;

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
                SELECT scored.id
                FROM (
                    SELECT r.id,
                        COALESCE(t.popularity, 0)
                        * EXP(
                            -DATEDIFF(CURDATE(), COALESCE(t.release_date, t.first_air_date)) / 60.0
                        ) AS score
                    FROM records r
                    JOIN tmdb_data t ON r.tmdb_id = t.id
                    WHERE t.popularity IS NOT NULL
                      AND t.popularity > 0
                ) scored
                ORDER BY scored.score DESC
                LIMIT %d
                """.formatted(POOL_SIZE);
    }

    @Override
    public String selectSqlWithScore() {
        return """
                SELECT scored.id, CAST(scored.score AS UNSIGNED) AS score
                FROM (
                    SELECT r.id,
                        COALESCE(t.popularity, 0)
                        * EXP(
                            -DATEDIFF(CURDATE(), COALESCE(t.release_date, t.first_air_date)) / 60.0
                        ) AS score
                    FROM records r
                    JOIN tmdb_data t ON r.tmdb_id = t.id
                    WHERE t.popularity IS NOT NULL
                      AND t.popularity > 0
                ) scored
                ORDER BY scored.score DESC
                LIMIT %d
                """.formatted(POOL_SIZE);
    }
}
