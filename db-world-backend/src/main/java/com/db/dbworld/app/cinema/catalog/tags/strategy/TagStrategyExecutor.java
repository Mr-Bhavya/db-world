package com.db.dbworld.app.cinema.catalog.tags.strategy;

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
 *     <li>Bulk-inserts new tags using the strategy's SQL</li>
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
        int priority = strategy.priority();

        log.debug("Executing tag strategy: {}", tagType);

        // 1. Delete existing tags of this type
        int deleted = entityManager.createNativeQuery(
                "DELETE FROM record_tags WHERE tag_type = :tagType"
        ).setParameter("tagType", tagType.name()).executeUpdate();

        // 2. Bulk-insert using the strategy's SQL
        String insertSql = String.format("""
                INSERT INTO record_tags (record_id, tag_type, priority)
                SELECT sub.id, '%s', %d
                FROM (%s) sub
                WHERE NOT EXISTS (
                    SELECT 1 FROM record_tags rt
                    WHERE rt.record_id = sub.id
                      AND rt.tag_type = '%s'
                )
                """,
                tagType.name(), priority,
                strategy.selectSql(),
                tagType.name()
        );

        int inserted = entityManager.createNativeQuery(insertSql).executeUpdate();

        log.debug("Tag [{}]: deleted={}, inserted={}", tagType, deleted, inserted);
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
