package com.db.dbworld.app.cinema.catalog.tags.rules;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.enums.RecordTagType;

import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class ShowOnTopTagRule implements RecordTagRule {

    @Override
    public Optional<TagAssignment> evaluate(RecordEntity record) {

        if (record.getType().name().equals("MOVIE")) {

            return Optional.of(new TagAssignment(
                    RecordTagType.SHOW_ON_TOP,
                    100
            ));
        }

        return Optional.empty();
    }
}