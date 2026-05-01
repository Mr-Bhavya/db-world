package com.db.dbworld.app.cinema.catalog.tags.strategy.impl;

import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

/**
 * Bulk strategy for TRENDING tags.
 *
 * <h3>Scoring formula (per record)</h3>
 * <pre>
 *   score = (popularity
 *            + recency_boost          -- +30 if released/aired within 30 days
 *            + new_season_boost)      -- +50 if new TV season aired within 14 days
 *           * exp(-days_since_release / 30)   -- exponential time-decay (half-life ≈ 21 days)
 * </pre>
 *
 * <h3>Previous bug (fixed)</h3>
 * The old formula applied decay only to {@code new_season_boost} due to SQL operator
 * precedence (* beats +). Old content with high TMDB popularity permanently dominated.
 * Fix: parenthesise the full sum before multiplying by EXP(…).
 *
 * <h3>Pool size</h3>
 * 60 records are tagged (up from 30). Rails that apply a record-type filter
 * (MOVIES → MOVIE only, SERIES → TV_SERIES only) draw from this pool independently,
 * so they do not exhaust each other.
 *
 * <h3>Score storage</h3>
 * {@code selectSqlWithScore()} stores the computed score as {@code record_tags.priority},
 * so rails sorted by {@code tagPriority} honour actual trending relevance.
 *
 * <h3>String formatting</h3>
 * All SQL uses {@code String.formatted()} rather than text-block concatenation.
 * Java text blocks strip trailing whitespace on each line, which caused
 * {@code LIMIT60} (missing space) when the closing {@code """} immediately
 * followed the keyword.
 */
@Component
public class TrendingTagStrategy implements TagStrategy {

    private static final int MIN_SCORE = 5;
    private static final int POOL_SIZE = 60;

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
                SELECT scored.id
                FROM (
                    SELECT r.id,
                        (
                            COALESCE(t.popularity, 0)
                            + CASE
                                WHEN NULLIF(t.release_date,   '') >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 30
                                WHEN NULLIF(t.first_air_date, '') >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 30
                                ELSE 0
                              END
                            + CASE
                                WHEN NULLIF(MAX(se.air_date), '') >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) THEN 50
                                ELSE 0
                              END
                        ) * EXP(
                            -DATEDIFF(CURDATE(), COALESCE(NULLIF(t.release_date, ''), NULLIF(t.first_air_date, ''))) / 30.0
                        ) AS score
                    FROM records r
                    JOIN tmdb_data t ON r.tmdb_id = t.id
                    LEFT JOIN tmdb_seasons se ON t.id = se.tmdb_id
                    GROUP BY r.id, t.popularity, t.release_date, t.first_air_date
                ) scored
                WHERE scored.score >= %d
                ORDER BY scored.score DESC
                LIMIT %d
                """.formatted(MIN_SCORE, POOL_SIZE);
    }

    @Override
    public String selectSqlWithScore() {
        return """
                SELECT scored.id, CAST(scored.score AS UNSIGNED) AS score
                FROM (
                    SELECT r.id,
                        (
                            COALESCE(t.popularity, 0)
                            + CASE
                                WHEN NULLIF(t.release_date,   '') >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 30
                                WHEN NULLIF(t.first_air_date, '') >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 30
                                ELSE 0
                              END
                            + CASE
                                WHEN NULLIF(MAX(se.air_date), '') >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) THEN 50
                                ELSE 0
                              END
                        ) * EXP(
                            -DATEDIFF(CURDATE(), COALESCE(NULLIF(t.release_date, ''), NULLIF(t.first_air_date, ''))) / 30.0
                        ) AS score
                    FROM records r
                    JOIN tmdb_data t ON r.tmdb_id = t.id
                    LEFT JOIN tmdb_seasons se ON t.id = se.tmdb_id
                    GROUP BY r.id, t.popularity, t.release_date, t.first_air_date
                ) scored
                WHERE scored.score >= %d
                ORDER BY scored.score DESC
                LIMIT %d
                """.formatted(MIN_SCORE, POOL_SIZE);
    }
}
