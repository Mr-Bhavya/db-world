package com.db.dbworld.app.cinema.catalog.tags.services;

import com.db.dbworld.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.cinema.catalog.entities.RecordTagEntity;
import com.db.dbworld.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.cinema.catalog.tags.rules.RecordTagRule;
import com.db.dbworld.cinema.catalog.tags.strategy.TagStrategyExecutor;
import com.db.dbworld.cinema.enums.RecordTagType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class RecordTaggingService {

    private final TagStrategyExecutor tagStrategyExecutor;

    private final RecordRepository recordRepository;
    private final List<RecordTagRule> rules;

    /**
     * Used when a new record is created — applies rule-based tags immediately.
     */
    public void assignTags(RecordEntity record) {
        applyRules(record, EnumSet.noneOf(RecordTagType.class));
    }

    /**
     * Recalculate rule-based tags for all records (per-record evaluation).
     */
    @Transactional
    public void recalculateRuleTags() {

        List<RecordEntity> records = recordRepository.findAllWithTmdbAndTags();

        for (RecordEntity record : records) {

            Set<RecordTagType> existingTags =
                    record.getTags()
                            .stream()
                            .map(RecordTagEntity::getTagType)
                            .collect(java.util.stream.Collectors.toSet());

            applyRules(record, existingTags);
        }

        recordRepository.saveAll(records);
    }

    /**
     * Applies all rule-based tags to a record.
     */
    private void applyRules(
            RecordEntity record,
            Set<RecordTagType> existingTags
    ) {

        for (RecordTagRule rule : rules) {

            rule.evaluate(record).ifPresent(assignment -> {

                if (!existingTags.contains(assignment.type())) {

                    RecordTagEntity tag = RecordTagEntity.builder()
                            .record(record)
                            .tagType(assignment.type())
                            .priority(assignment.priority())
                            .build();

                    record.getTags().add(tag);

                    existingTags.add(assignment.type());
                }
            });
        }
    }

    /**
     * Bulk recalculate ALL tags using strategy executor.
     * Called by the scheduler.
     */
    public void recalculateAllTags() {
        tagStrategyExecutor.executeAll();
    }
}
