package com.db.dbworld.app.cinema.catalog.tags.strategy;

import com.db.dbworld.app.cinema.catalog.tags.services.TagDefinitionService;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Generic executor that processes every registered {@link TagStrategy}.
 *
 * <p>For each strategy it:
 * <ol>
 *     <li>Deletes existing tags of that type</li>
 *     <li>Bulk-inserts new tags using the strategy's SQL, storing computed scores
 *         as {@code priority} via {@link TagStrategy#selectSqlWithScore()}</li>
 *     <li>Updates {@link TagDefinitionEntity#lastRefreshedAt} via
 *         {@link TagDefinitionService#markRefreshed(String)}</li>
 * </ol>
 *
 * <p><b>To add a new tag:</b> just create a new {@code @Component}
 * implementing {@link TagStrategy} — it will be auto-discovered here.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class TagStrategyExecutor {

    private final List<TagStrategy> strategies;
    private final TagDefinitionService tagDefinitionService;

    @PersistenceContext
    private final EntityManager entityManager;

    /**
     * Re-calculate ALL tag types registered as strategies.
     */
    @Transactional
    public void executeAll() {
        for (TagStrategy strategy : strategies) {
            execute(strategy);
        }
    }

    /**
     * Re-calculate a single tag type.
     */
    @Transactional
    public void execute(TagStrategy strategy) {

        RecordTagType tagType = strategy.tagType();

        log.debug("Executing tag strategy: {}", tagType);

        // 1. Delete existing tags of this type
        int deleted = entityManager.createNativeQuery(
                "DELETE FROM record_tags WHERE tag_type = :tagType"
        ).setParameter("tagType", tagType.name()).executeUpdate();

        // 2. Bulk-insert using the strategy's SQL with per-record scores.
        //    selectSqlWithScore() returns (id, score) — score is stored as priority.
        //    The default implementation uses the static priority() value for all rows.
        String insertSql = String.format("""
                INSERT INTO record_tags (record_id, tag_type, priority)
                SELECT sw.id, '%s', sw.score
                FROM (%s) sw
                WHERE NOT EXISTS (
                    SELECT 1 FROM record_tags rt
                    WHERE rt.record_id = sw.id
                      AND rt.tag_type  = '%s'
                )
                """,
                tagType.name(),
                strategy.selectSqlWithScore(),
                tagType.name()
        );

        int inserted = entityManager.createNativeQuery(insertSql).executeUpdate();

        log.debug("Tag [{}]: deleted={}, inserted={}", tagType, deleted, inserted);

        // 3. Record the last-refresh timestamp in tag_definitions
        tagDefinitionService.markRefreshed(tagType.name());
    }

    /**
     * Execute a specific tag type by enum value.
     */
    @Transactional
    public void execute(RecordTagType tagType) {
        strategies.stream()
                .filter(s -> s.tagType() == tagType)
                .findFirst()
                .ifPresent(this::execute);
    }
}
