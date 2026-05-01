package com.db.dbworld.app.cinema.catalog.tags.rules;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Assigns EDITOR_PICK tag to critically acclaimed content
 * (high rating AND high vote count).
 */
@Component
public class EditorPickTagRule implements RecordTagRule {

    private static final double MIN_VOTE_AVERAGE = 8.0;
    private static final int MIN_VOTE_COUNT = 1000;

    @Override
    public Optional<TagAssignment> evaluate(RecordEntity record) {

        if (record.getTmdb() == null)
            return Optional.empty();

        double voteAverage = record.getTmdb().getVoteAverage();
        int voteCount = record.getTmdb().getVoteCount();

        if (voteAverage >= MIN_VOTE_AVERAGE && voteCount >= MIN_VOTE_COUNT) {

            return Optional.of(
                    new TagAssignment(RecordTagType.EDITOR_PICK, 30)
            );
        }

        return Optional.empty();
    }
}
