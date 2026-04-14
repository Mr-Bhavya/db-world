package com.db.dbworld.app.cinema.catalog.tags.strategy.impl;

import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

/**
 * Bulk strategy for EDITOR_PICK tags.
 *
 * <h3>Eligibility</h3>
 * Critically acclaimed content:
 * <ul>
 *   <li>{@code vote_average >= 8.0}  — exceptional rating</li>
 *   <li>{@code vote_count   >= 500}  — enough votes for the rating to be meaningful</li>
 * </ul>
 *
 * <h3>Scoring formula</h3>
 * <pre>
 *   score = (vote_average * 10 + vote_count * 0.01)
 *           * exp(-days_since_release / 120)
 * </pre>
 * <ul>
 *   <li>Quality-dominant: vote_average at 8.5 → 85 base score.</li>
 *   <li>Small vote-count contribution rewards heavily reviewed content.</li>
 *   <li>120-day half-life — the slowest decay of any tag.  Classics stay
 *       visible for months, but newer acclaimed content will eventually
 *       displace them as their decay factors converge.</li>
 * </ul>
 *
 * <h3>Manual overrides</h3>
 * Admin can manually add any record to EDITOR_PICK via the bulk-add API.
 * Manually-assigned records will be replaced on the next scheduler run
 * unless they also meet the eligibility criteria.  For permanent manual
 * curation, assign via the admin UI after each recalculate run.
 */
@Component
public class EditorPickTagStrategy implements TagStrategy {

    private static final double MIN_VOTE_AVERAGE = 8.0;
    private static final int    MIN_VOTE_COUNT   = 500;
    private static final int    POOL_SIZE        = 30;

    @Override
    public RecordTagType tagType() {
        return RecordTagType.EDITOR_PICK;
    }

    @Override
    public int priority() {
        return 30;
    }

    @Override
    public String selectSql() {
        return """
                SELECT scored.id
                FROM (
                    SELECT r.id,
                        (COALESCE(t.vote_average, 0) * 10 + COALESCE(t.vote_count, 0) * 0.01)
                        * EXP(
                            -DATEDIFF(CURDATE(), COALESCE(t.release_date, t.first_air_date)) / 120.0
                        ) AS score
                    FROM records r
                    JOIN tmdb_data t ON r.tmdb_id = t.id
                    WHERE t.vote_average >= %s
                      AND COALESCE(t.vote_count, 0) >= %d
                ) scored
                ORDER BY scored.score DESC
                LIMIT %d
                """.formatted(MIN_VOTE_AVERAGE, MIN_VOTE_COUNT, POOL_SIZE);
    }

    @Override
    public String selectSqlWithScore() {
        return """
                SELECT scored.id, CAST(scored.score AS UNSIGNED) AS score
                FROM (
                    SELECT r.id,
                        (COALESCE(t.vote_average, 0) * 10 + COALESCE(t.vote_count, 0) * 0.01)
                        * EXP(
                            -DATEDIFF(CURDATE(), COALESCE(t.release_date, t.first_air_date)) / 120.0
                        ) AS score
                    FROM records r
                    JOIN tmdb_data t ON r.tmdb_id = t.id
                    WHERE t.vote_average >= %s
                      AND COALESCE(t.vote_count, 0) >= %d
                ) scored
                ORDER BY scored.score DESC
                LIMIT %d
                """.formatted(MIN_VOTE_AVERAGE, MIN_VOTE_COUNT, POOL_SIZE);
    }
}
