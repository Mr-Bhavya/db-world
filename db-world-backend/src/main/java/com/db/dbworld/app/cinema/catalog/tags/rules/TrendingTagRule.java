package com.db.dbworld.app.cinema.catalog.tags.rules;

import com.db.dbworld.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class TrendingTagRule implements RecordTagRule {

    private static final double TRENDING_THRESHOLD = 80.0;

    @Override
    public Optional<TagAssignment> evaluate(RecordEntity record) {

        if (record.getTmdb() == null)
            return Optional.empty();

        Double popularity = record.getTmdb().getPopularity();

        if (popularity == null)
            return Optional.empty();

        if (popularity >= TRENDING_THRESHOLD) {

            return Optional.of(
                    new TagAssignment(
                            RecordTagType.TRENDING,
                            70
                    )
            );
        }

        return Optional.empty();
    }
}