package com.db.dbworld.app.cinema.catalog.tags.rules;

import com.db.dbworld.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Assigns FEATURED tag to records with high rating and decent popularity.
 */
@Component
public class FeaturedTagRule implements RecordTagRule {

    private static final double MIN_VOTE_AVERAGE = 7.5;
    private static final double MIN_POPULARITY = 50.0;

    @Override
    public Optional<TagAssignment> evaluate(RecordEntity record) {

        if (record.getTmdb() == null)
            return Optional.empty();

        Double popularity = record.getTmdb().getPopularity();
        double voteAverage = record.getTmdb().getVoteAverage();

        if (popularity == null)
            return Optional.empty();

        if (voteAverage >= MIN_VOTE_AVERAGE && popularity >= MIN_POPULARITY) {

            return Optional.of(
                    new TagAssignment(RecordTagType.FEATURED, 20)
            );
        }

        return Optional.empty();
    }
}
