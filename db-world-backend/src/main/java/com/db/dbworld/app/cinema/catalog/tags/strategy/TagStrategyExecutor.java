package com.db.dbworld.app.cinema.catalog.tags.strategy;

import com.db.dbworld.app.cinema.catalog.tags.entity.TagDefinitionEntity;
import com.db.dbworld.app.cinema.catalog.tags.rule.RuleTagRefresher;
import com.db.dbworld.app.cinema.common.events.BulkRecordChangedEvent;
import com.db.dbworld.app.cinema.catalog.tags.services.TagDefinitionService;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

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
    private final RuleTagRefresher ruleTagRefresher;

    /**
     * Rail caches are keyed on record membership, which is exactly what a tag refresh rewrites.
     * Without this a recalculated tag took up to the 3-minute cache TTL to show on a rail, which
     * made the admin "Recalculate" button look like it had done nothing.
     */
    private final ApplicationEventPublisher publisher;

    @PersistenceContext
    private final EntityManager entityManager;

    /**
     * The tag types that have a registered strategy — i.e. the ones the scheduler recomputes.
     *
     * <p>This is the definition of "automatic": a tag is automatic precisely because code exists to
     * compute it. Anything absent here is admin-curated, and nothing will ever overwrite it. Derived
     * from the injected strategies rather than a hand-kept list, so adding or deleting a strategy
     * updates the admin UI with no second place to remember.
     */
    public Set<String> managedTagTypes() {
        return strategies.stream()
                .map(s -> s.tagType().name())
                .collect(Collectors.toUnmodifiableSet());
    }

    /**
     * Re-calculate ALL tag types registered as strategies, skipping any whose
     * {@link TagDefinitionEntity#isActive()} flag is off.
     *
     * <p>Skipping leaves the tag's existing rows in place rather than deleting them, so a rail
     * pointing at a deactivated tag freezes at its last-computed contents instead of going empty.
     * To actually clear a tag, deactivate it and remove the rows from the admin UI.
     */
    @Transactional
    public void executeAll() {
        for (TagStrategy strategy : strategies) {
            String tagType = strategy.tagType().name();
            if (!tagDefinitionService.getOrDefault(tagType).isActive()) {
                log.info("Tag strategy skipped — definition is inactive; tagType={}", tagType);
                continue;
            }
            execute(strategy);
        }
        refreshRuleTags();
        // Once, after everything — a per-strategy evictAll would clear the cache 10+ times per run.
        publisher.publishEvent(new BulkRecordChangedEvent());
    }

    /**
     * Recomputes every admin-defined rule tag, after the code strategies.
     *
     * <p>Each is isolated: one bad rule logs and is skipped rather than aborting the whole run, so a
     * single malformed admin rule can't stop TRENDING from refreshing. Tags owned by a strategy are
     * skipped even if they somehow also carry a rule — the strategy is authoritative.
     */
    private void refreshRuleTags() {
        Set<String> strategyOwned = managedTagTypes();

        for (TagDefinitionEntity def : tagDefinitionService.findAll()) {
            if (def.getRule() == null || def.getRule().isEmpty()) continue;
            if (strategyOwned.contains(def.getTagType())) {
                log.debug("Tag {} has both a strategy and a rule — strategy wins", def.getTagType());
                continue;
            }
            if (!def.isActive()) {
                log.info("Rule tag skipped — definition is inactive; tagType={}", def.getTagType());
                continue;
            }
            try {
                ruleTagRefresher.refresh(def);
                tagDefinitionService.markRefreshed(def.getTagType());
            } catch (Exception e) {
                // Deliberately swallowed: an admin-authored rule is untrusted input, and one broken
                // rule must not take the whole tag refresh down with it.
                log.error("Rule tag refresh failed; tagType={}", def.getTagType(), e);
            }
        }
    }

    /**
     * Re-calculate a single tag type.
     */
    @Transactional
    public void execute(TagStrategy strategy) {

        RecordTagType tagType = strategy.tagType();

        log.debug("Executing tag strategy: {}", tagType);

        try {
            // 1. Delete existing tags of this type
            int deleted = entityManager.createNativeQuery(
                    "DELETE FROM record_tags WHERE tag_type = :tagType"
            ).setParameter("tagType", tagType.name()).executeUpdate();

            // 2. Bulk-insert using the strategy's SQL. selectSql() returns (id, score); score
            //    lands in record_tags.priority, which is what a tagPriority-sorted rail orders on.
            String insertSql = String.format("""
                    INSERT INTO record_tags (record_id, tag_type, priority)
                    SELECT sw.id, '%s', sw.score
                    FROM (%s) sw
                    """,
                    tagType.name(),
                    strategy.selectSql()
            );

            int inserted = entityManager.createNativeQuery(insertSql).executeUpdate();

            if (inserted == 0) {
                log.warn("Tag strategy produced zero matches; tagType={}, deleted={}", tagType, deleted);
            } else {
                log.info("Tag recomputed; tagType={}, deleted={}, inserted={}", tagType, deleted, inserted);
            }

            // 3. Record the last-refresh timestamp in tag_definitions
            tagDefinitionService.markRefreshed(tagType.name());
        } catch (Exception e) {
            log.error("Tag strategy execution failed; tagType={}", tagType, e);
            throw e;
        }
    }

    /**
     * Execute a single tag type by name. A no-op for admin-created tags, which have no strategy —
     * there is nothing to recompute, and their records are curated by hand.
     */
    @Transactional
    public void execute(String tagType) {
        var strategy = strategies.stream()
                .filter(s -> s.tagType().name().equals(tagType))
                .findFirst();
        if (strategy.isPresent()) {
            execute(strategy.get());
            publisher.publishEvent(new BulkRecordChangedEvent());
            return;
        }

        // No code strategy — it may still be an admin-defined rule tag.
        TagDefinitionEntity def = tagDefinitionService.getOrDefault(tagType);
        if (def != null && def.getRule() != null && !def.getRule().isEmpty()) {
            ruleTagRefresher.refresh(def);
            tagDefinitionService.markRefreshed(tagType);
            publisher.publishEvent(new BulkRecordChangedEvent());
            return;
        }

        log.debug("No strategy or rule for tag {} — nothing to recalculate (manual tag)", tagType);
    }
}
