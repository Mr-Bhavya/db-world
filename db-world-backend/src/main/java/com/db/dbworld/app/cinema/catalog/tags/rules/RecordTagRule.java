package com.db.dbworld.app.cinema.catalog.tags.rules;

import com.db.dbworld.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.cinema.enums.RecordTagType;

import java.util.Optional;

public interface RecordTagRule {

    Optional<TagAssignment> evaluate(RecordEntity record);

    record TagAssignment(RecordTagType type, int priority) {}
}