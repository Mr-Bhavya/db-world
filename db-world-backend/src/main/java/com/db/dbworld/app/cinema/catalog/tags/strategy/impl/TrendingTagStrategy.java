package com.db.dbworld.app.cinema.catalog.tags.strategy.impl;

import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

/**
 * Records with TMDB popularity >= 80.
 */
@Component
public class TrendingTagStrategy implements TagStrategy {

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
        SELECT r.id
        FROM records r
        JOIN tmdb_data t ON r.tmdb_id = t.id
        
        LEFT JOIN tv_series s ON t.id = s.tmdb_id
        LEFT JOIN season se ON s.id = se.series_id
        
        GROUP BY r.id, t.popularity, t.release_date, t.first_air_date
        
        ORDER BY (
            -- Base popularity
            COALESCE(t.popularity, 0)

            -- Recency boost
            + CASE 
                WHEN t.release_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 30
                WHEN t.first_air_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 30
                ELSE 0
              END

            -- New season boost
            + CASE 
                WHEN MAX(se.air_date) >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) THEN 50
                ELSE 0
              END

            -- Time decay
            * EXP(
                - DATEDIFF(
                    CURDATE(),
                    COALESCE(t.release_date, t.first_air_date)
                ) / 30.0
              )

        ) DESC
        
        LIMIT 30
        """;
    }
}
