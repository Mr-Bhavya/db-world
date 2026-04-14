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
 * <h3>Previous bug (fixed here)</h3>
 * The old formula was:
 * <pre>
 *   popularity + recency_boost + new_season_boost * EXP(...)
 * </pre>
 * Due to SQL operator precedence (* beats +), the decay was only applied to the
 * new_season_boost term, leaving base popularity and recency completely undecayed.
 * Old content with high TMDB popularity would permanently dominate the rail.
 *
 * <h3>Diversity</h3>
 * Pool is set to 60 records (up from 30).  Rails that apply a record-type filter
 * (MOVIES page → MOVIE only, SERIES page → TV_SERIES only) each pull from this
 * same pool independently, so they don't exhaust each other.
 *
 * <h3>Score storage</h3>
 * {@link #selectSqlWithScore()} returns {@code (id, score)} so the executor can
 * store the computed score as {@code record_tags.priority}.  Rails with
 * {@code defaultSort = "tagPriority"} then sort by this stored value, ensuring
 * the display order matches the actual trending relevance — not just TMDB popularity.
 */
@Component
public class TrendingTagStrategy implements TagStrategy {

    /** Minimum computed score for a record to be included in the TRENDING pool. */
    private static final int MIN_SCORE = 5;

    /** Maximum pool size — how many records are tagged as TRENDING per refresh. */
    private static final int POOL_SIZE = 60;

    @Override
    public RecordTagType tagType() {
        return RecordTagType.TRENDING;
    }

    /**
     * Static fallback priority (used only if {@link #selectSqlWithScore()} is bypassed).
     * Normal operation stores per-record computed scores via {@link #selectSqlWithScore()}.
     */
    @Override
    public int priority() {
        return 70;
    }

    /**
     * Returns record IDs ordered by trending score (descending).
     *
     * <p>This variant returns only the {@code id} column. It is kept correct for
     * backwards-compatibility but the executor always uses {@link #selectSqlWithScore()}.
     */
    @Override
    public String selectSql() {
        return """
                SELECT scored.id
                FROM (
                    SELECT r.id,
                        (
                            COALESCE(t.popularity, 0)
                            + CASE
                                WHEN t.release_date   >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 30
                                WHEN t.first_air_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 30
                                ELSE 0
                              END
                            + CASE
                                WHEN MAX(se.air_date) >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) THEN 50
                                ELSE 0
                              END
                        ) * EXP(
                            -DATEDIFF(CURDATE(), COALESCE(t.release_date, t.first_air_date)) / 30.0
                        ) AS score
                    FROM records r
                    JOIN tmdb_data t  ON r.tmdb_id = t.id
                    LEFT JOIN tv_series s  ON t.id = s.tmdb_id
                    LEFT JOIN season   se ON s.id  = se.series_id
                    GROUP BY r.id, t.popularity, t.release_date, t.first_air_date
                ) scored
                WHERE scored.score >= """ + MIN_SCORE + """

                ORDER BY scored.score DESC
                LIMIT """ + POOL_SIZE;
    }

    /**
     * Returns {@code (id, score)} so the executor can persist the computed relevance
     * score as {@code record_tags.priority}.  Rails sorted by {@code tagPriority}
     * will then honour the actual trending rank.
     */
    @Override
    public String selectSqlWithScore() {
        return """
                SELECT scored.id, CAST(scored.score AS UNSIGNED) AS score
                FROM (
                    SELECT r.id,
                        (
                            COALESCE(t.popularity, 0)
                            + CASE
                                WHEN t.release_date   >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 30
                                WHEN t.first_air_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 30
                                ELSE 0
                              END
                            + CASE
                                WHEN MAX(se.air_date) >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) THEN 50
                                ELSE 0
                              END
                        ) * EXP(
                            -DATEDIFF(CURDATE(), COALESCE(t.release_date, t.first_air_date)) / 30.0
                        ) AS score
                    FROM records r
                    JOIN tmdb_data t  ON r.tmdb_id = t.id
                    LEFT JOIN tv_series s  ON t.id = s.tmdb_id
                    LEFT JOIN season   se ON s.id  = se.series_id
                    GROUP BY r.id, t.popularity, t.release_date, t.first_air_date
                ) scored
                WHERE scored.score >= """ + MIN_SCORE + """

                ORDER BY scored.score DESC
                LIMIT """ + POOL_SIZE;
    }
}
