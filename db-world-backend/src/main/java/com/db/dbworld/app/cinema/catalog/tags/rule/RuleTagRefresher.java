package com.db.dbworld.app.cinema.catalog.tags.rule;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.repository.RecordTagRepository;
import com.db.dbworld.app.cinema.catalog.entities.RecordTagEntity;
import com.db.dbworld.app.cinema.catalog.tags.entity.TagDefinitionEntity;
import com.db.dbworld.app.cinema.rail.util.RailSortBuilder;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Materialises admin-defined {@link TagRule}s into {@code record_tags}.
 *
 * <p>The eight built-in tags are native-SQL {@code TagStrategy} beans, because their scoring needs
 * time-decay maths. Admin-defined tags instead carry a structured rule that
 * {@link TagRuleEvaluator} compiles into a JPA Specification — same delete-then-insert refresh
 * semantics, but nothing the admin types ever becomes SQL text.
 *
 * <h3>Why materialise at all, rather than resolve the rule at render time?</h3>
 * Two reasons. A tag is reusable — several rails, and the record-detail chips, all read the same
 * membership, so evaluating once per refresh beats evaluating per request. And membership carries a
 * {@code priority} score, which is what lets a rail sort by "Smart ranking" rather than re-running
 * the rule's own ordering.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class RuleTagRefresher {

    /** Ceiling on how many records one rule may tag, when the rule sets no limit of its own. */
    private static final int DEFAULT_LIMIT = 60;

    /** Hard ceiling regardless of what the rule asks for — a tag is a shortlist, not the catalogue. */
    private static final int MAX_LIMIT = 500;

    private final RecordRepository recordRepository;
    private final RecordTagRepository recordTagRepository;
    private final TagRuleEvaluator evaluator;
    private final RailSortBuilder railSortBuilder;
    private final EntityManager entityManager;

    /**
     * Recomputes one rule-driven tag: resolve the rule, then replace the tag's rows wholesale.
     *
     * <p>Scores are assigned by rank rather than by the raw field value, so a tag ordered by
     * {@code publishedAt} (an Instant) and one ordered by {@code popularity} (a Double) both end up
     * with comparable small integers in {@code priority}, and "Smart ranking" on a rail reproduces
     * the rule's own ordering.
     *
     * @return how many records ended up tagged
     */
    @Transactional
    public int refresh(TagDefinitionEntity def) {
        String tagType = def.getTagType();
        TagRule rule = def.getRule();

        if (rule == null || rule.isEmpty()) {
            log.debug("Tag {} has no usable rule — skipping", tagType);
            return 0;
        }

        int limit = Math.min(
                rule.getLimit() != null && rule.getLimit() > 0 ? rule.getLimit() : DEFAULT_LIMIT,
                MAX_LIMIT);

        Sort sort = railSortBuilder.build(
                rule.getScoreBy(),
                rule.getScoreDirection() == null ? "DESC" : rule.getScoreDirection());
        // tagPriority is meaningless as a rule's own ordering — it IS the thing being computed.
        if (RailSortBuilder.isTagPrioritySort(sort)) {
            log.debug("Tag {} scores by tagPriority, which is what this computes — using natural order",
                    tagType);
            sort = Sort.unsorted();
        }

        Pageable page = PageRequest.of(0, limit, sort);
        List<Long> ids = recordRepository.findIdsBySpecification(
                evaluator.toSpecification(rule), page).getContent();

        // Replace wholesale, mirroring TagStrategyExecutor. Bulk-delete then bulk-insert so a tag
        // holding hundreds of rows doesn't turn into hundreds of entity loads.
        recordTagRepository.deleteByTagType(tagType);
        entityManager.flush();

        int priority = ids.size();
        for (Long id : ids) {
            RecordEntity ref = entityManager.getReference(RecordEntity.class, id);
            recordTagRepository.save(RecordTagEntity.builder()
                    .record(ref)
                    .tagType(tagType)
                    .priority(priority--)   // first match scores highest
                    .build());
        }

        if (ids.isEmpty()) {
            log.warn("Rule tag matched zero records; tagType={}", tagType);
        } else {
            log.info("Rule tag recomputed; tagType={}, tagged={}, limit={}", tagType, ids.size(), limit);
        }
        return ids.size();
    }

    /**
     * Previews a rule without writing anything — powers the admin "how many would this match?"
     * check, so a rule can be sanity-tested before it replaces a live tag's contents.
     */
    @Transactional(readOnly = true)
    public List<Long> preview(TagRule rule, int limit) {
        if (rule == null || rule.isEmpty()) return List.of();
        Sort sort = railSortBuilder.build(
                rule.getScoreBy(),
                rule.getScoreDirection() == null ? "DESC" : rule.getScoreDirection());
        if (RailSortBuilder.isTagPrioritySort(sort)) sort = Sort.unsorted();
        return recordRepository.findIdsBySpecification(
                evaluator.toSpecification(rule),
                PageRequest.of(0, Math.min(limit, MAX_LIMIT), sort)).getContent();
    }
}
