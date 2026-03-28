package com.db.dbworld.app.cinema.catalog.tags.rules;

import com.db.dbworld.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.cinema.enums.RecordTagType;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

@Component
public class RecentlyAddedRule implements RecordTagRule {

    private static final int DAYS = 14;

    @Override
    public Optional<TagAssignment> evaluate(RecordEntity record) {

        Instant created = record.getCreatedAt();

        if (created == null)
            return Optional.empty();

        if (created.isAfter(Instant.now().minus(DAYS, ChronoUnit.DAYS))) {

            return Optional.of(
                    new TagAssignment(
                            RecordTagType.RECENTLY_ADDED,
                            40
                    )
            );
        }

        return Optional.empty();
    }
}