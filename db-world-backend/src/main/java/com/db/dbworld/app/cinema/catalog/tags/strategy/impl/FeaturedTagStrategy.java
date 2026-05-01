package com.db.dbworld.app.cinema.catalog.tags.strategy.impl;

import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

/**
 * Bulk strategy for FEATURED tags.
 *
 * <h3>Eligibility</h3>
 * A record must have:
 * <ul>
 *   <li>{@code vote_average >= 7.5}   — genuinely well-rated</li>
 *   <li>{@code popularity  >= 50}     — has audience reach</li>
 * </ul>
 *
 * <h3>Scoring formula</h3>
 * <pre>
 *   score = (vote_average * 10  +  popularity * 0.1)
 *           * exp(-days_since_release / 90)
 * </pre>
 * <ul>
 *   <li>{@code vote_average * 10} — quality is the dominant factor (7.5 → 75 pts).</li>
 *   <li>{@code popularity * 0.1} — small recency/reach contribution.</li>
 *   <li>90-day half-life — slower decay than TRENDING; quality content stays visible
 *       longer but newer quality content still rises above older entries.</li>
 * </ul>
 *
 * <p>Without the time-decay, the featured rail always shows the same highly-rated
 * titles forever (old movies with a 9.0 TMDB rating would always top the list).
 * The decay ensures a rotating selection while still favouring quality.
 */
@Component
public class FeaturedTagStrategy implements TagStrategy {

    private static final double MIN_VOTE_AVERAGE = 7.5;
    private static final double MIN_POPULARITY   = 50.0;
    private static final int    POOL_SIZE        = 50;

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
                SELECT scored.id
                FROM (
                    SELECT r.id,
                        (COALESCE(t.vote_average, 0) * 10 + COALESCE(t.popularity, 0) * 0.1)
                        * EXP(
                            -DATEDIFF(CURDATE(), COALESCE(NULLIF(t.release_date, ''), NULLIF(t.first_air_date, ''))) / 90.0
                        ) AS score
                    FROM records r
                    JOIN tmdb_data t ON r.tmdb_id = t.id
                    WHERE t.vote_average >= %s
                      AND COALESCE(t.popularity, 0) >= %s
                ) scored
                ORDER BY scored.score DESC
                LIMIT %d
                """.formatted(MIN_VOTE_AVERAGE, MIN_POPULARITY, POOL_SIZE);
    }

    @Override
    public String selectSqlWithScore() {
        return """
                SELECT scored.id, CAST(scored.score AS UNSIGNED) AS score
                FROM (
                    SELECT r.id,
                        (COALESCE(t.vote_average, 0) * 10 + COALESCE(t.popularity, 0) * 0.1)
                        * EXP(
                            -DATEDIFF(CURDATE(), COALESCE(NULLIF(t.release_date, ''), NULLIF(t.first_air_date, ''))) / 90.0
                        ) AS score
                    FROM records r
                    JOIN tmdb_data t ON r.tmdb_id = t.id
                    WHERE t.vote_average >= %s
                      AND COALESCE(t.popularity, 0) >= %s
                ) scored
                ORDER BY scored.score DESC
                LIMIT %d
                """.formatted(MIN_VOTE_AVERAGE, MIN_POPULARITY, POOL_SIZE);
    }
}
