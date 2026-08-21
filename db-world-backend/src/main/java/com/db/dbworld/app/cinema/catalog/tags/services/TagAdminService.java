package com.db.dbworld.app.cinema.catalog.tags.services;

import com.db.dbworld.app.cinema.catalog.dto.RecordAdminRowDto;
import com.db.dbworld.app.cinema.catalog.dto.RecordTagDto;
import com.db.dbworld.app.cinema.catalog.dto.TagSummaryDto;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.entities.RecordTagEntity;
import com.db.dbworld.app.cinema.catalog.mapper.RecordTagMapper;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.repository.RecordTagRepository;
import com.db.dbworld.app.cinema.common.events.BulkRecordChangedEvent;
import com.db.dbworld.app.cinema.common.events.RecordChangedEvent;
import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategyExecutor;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Log4j2
@Service
@RequiredArgsConstructor
public class TagAdminService {

    private final RecordTagRepository tagRepository;
    private final RecordRepository recordRepository;
    private final RecordTagMapper tagMapper;
    private final TagStrategyExecutor tagStrategyExecutor;
    private final TagDefinitionService tagDefinitionService;

    /**
     * Rail caches key on record membership, so a tag change has to evict them. Tag writes used to
     * skip this entirely — only the catalog controller's inline path published anything — so a tag
     * added from the Tags page took up to the 3-minute cache TTL to appear on a rail.
     */
    private final ApplicationEventPublisher publisher;

    // ── Summary ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<TagSummaryDto> getTagSummary() {
        // Driven by tag_definitions rather than RecordTagType.values(), so admin-created tags show up
        // here too. "Automatic" is resolved by TagDefinitionService, covering both a built-in strategy
        // and an admin-authored rule, so this can't drift from what the write guards enforce.
        Set<String> strategyOwned = tagStrategyExecutor.managedTagTypes();
        return tagDefinitionService.findAll().stream()
                .map(def -> new TagSummaryDto(
                        def.getTagType(),
                        tagRepository.countByTagType(def.getTagType()),
                        def.getDisplayName(),
                        tagDefinitionService.isAutomatic(def),
                        def.isActive(),
                        RecordTagType.isBuiltIn(def.getTagType()),
                        // Distinguishes "computed by code" from "computed by your rule" — the latter
                        // is editable in the UI, the former isn't.
                        def.getRule() != null && !strategyOwned.contains(def.getTagType())
                ))
                .toList();
    }

    // ── Records by tag ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<RecordAdminRowDto> getRecordsByTag(String tagType, Pageable pageable) {
        return recordRepository.findAdminTableByTag(requireExisting(tagType), pageable);
    }

    // ── Bulk add ─────────────────────────────────────────────────────────────

    @Transactional
    public int bulkAdd(String rawTagType, List<Long> recordIds, int priority) {
        final String tagType = requireManual(rawTagType);
        log.debug("bulkAdd entry; tagType={}, recordCount={}, priority={}",
                tagType, recordIds != null ? recordIds.size() : 0, priority);
        int added = 0;
        for (Long id : recordIds) {
            RecordEntity record = recordRepository.findById(id)
                    .orElseThrow(() -> new EntityNotFoundException("Record not found: " + id));
            boolean alreadyHas = record.getTags().stream()
                    .anyMatch(t -> tagType.equals(t.getTagType()));
            if (!alreadyHas) {
                record.getTags().add(RecordTagEntity.builder()
                        .record(record)
                        .tagType(tagType)
                        .priority(priority)
                        .build());
                recordRepository.save(record);
                added++;
            }
        }
        log.info("Tag bulkAdd completed; tagType={}, requested={}, added={}",
                tagType, recordIds != null ? recordIds.size() : 0, added);
        // One bulk eviction rather than N per-record ones — a 100-record bulk-add would otherwise
        // fire 100 evictions to achieve the same thing.
        if (added > 0) publisher.publishEvent(new BulkRecordChangedEvent());
        return added;
    }

    // ── Bulk remove ──────────────────────────────────────────────────────────

    @Transactional
    public int bulkRemove(String rawTagType, List<Long> recordIds) {
        final String tagType = requireManual(rawTagType);
        log.debug("bulkRemove entry; tagType={}, recordCount={}",
                tagType, recordIds != null ? recordIds.size() : 0);
        int removed = 0;
        for (Long id : recordIds) {
            RecordEntity record = recordRepository.findById(id)
                    .orElseThrow(() -> new EntityNotFoundException("Record not found: " + id));
            int before = record.getTags().size();
            record.getTags().removeIf(t -> tagType.equals(t.getTagType()));
            if (record.getTags().size() < before) {
                recordRepository.save(record);
                removed++;
            }
        }
        log.info("Tag bulkRemove completed; tagType={}, requested={}, removed={}",
                tagType, recordIds != null ? recordIds.size() : 0, removed);
        if (removed > 0) publisher.publishEvent(new BulkRecordChangedEvent());
        return removed;
    }

    // ── Single-record tag CRUD (merged from RecordTagController) ─────────────

    @Transactional
    public RecordTagDto addTagToRecord(Long recordId, RecordTagDto dto) {
        RecordEntity record = recordRepository.findById(recordId)
                .orElseThrow(() -> new EntityNotFoundException("Record not found: " + recordId));
        RecordTagEntity entity = tagMapper.toEntity(dto);
        // Validate here too — this path takes the tag name straight from the request body, so
        // without it a typo would write a tag_type no rail can ever match.
        entity.setTagType(requireManual(dto.getTagType()));
        entity.setRecord(record);
        RecordTagDto saved = tagMapper.toDto(tagRepository.save(entity));
        publisher.publishEvent(new RecordChangedEvent(recordId));
        return saved;
    }

    /**
     * Removes a tag from a record by tag NAME rather than by row id.
     *
     * <p>Exists because the inline chips in the records table know which tag they represent but not
     * its {@code record_tags.id}. This replaces the near-duplicate pair that used to live on
     * {@code CatalogAdminController} — those bypassed {@link #requireManual}, so the inline chip
     * happily added to an automatic tag that the scheduler then wiped, while the Tags page refused
     * the same operation.
     *
     * @return true if the record actually carried the tag
     */
    @Transactional
    public boolean removeTagFromRecord(Long recordId, String rawTagType) {
        final String tagType = requireManual(rawTagType);
        RecordEntity record = recordRepository.findById(recordId)
                .orElseThrow(() -> new EntityNotFoundException("Record not found: " + recordId));

        boolean removed = record.getTags().removeIf(t -> tagType.equals(t.getTagType()));
        if (removed) {
            recordRepository.save(record);
            publisher.publishEvent(new RecordChangedEvent(recordId));
        }
        return removed;
    }

    @Transactional
    public RecordTagDto updateTagPriority(Long tagId, RecordTagDto dto) {
        RecordTagEntity tag = tagRepository.findById(tagId)
                .orElseThrow(() -> new EntityNotFoundException("Tag not found: " + tagId));
        tag.setPriority(dto.getPriority());
        RecordTagDto saved = tagMapper.toDto(tagRepository.save(tag));
        // Priority IS the ordering for a tagPriority-sorted rail, so a change reorders it.
        if (tag.getRecord() != null) publisher.publishEvent(new RecordChangedEvent(tag.getRecord().getId()));
        return saved;
    }

    @Transactional
    public void deleteTagEntry(Long tagId) {
        // Read the record id BEFORE deleting — afterwards there's nothing left to evict against.
        Long recordId = tagRepository.findById(tagId)
                .map(t -> t.getRecord() != null ? t.getRecord().getId() : null)
                .orElse(null);
        tagRepository.deleteById(tagId);
        if (recordId != null) publisher.publishEvent(new RecordChangedEvent(recordId));
    }

    // ── Recalculate ──────────────────────────────────────────────────────────

    @Transactional
    public void recalculateOne(String tagType) {
        log.info("Tag recalculate (single) triggered; tagType={}", tagType);
        tagStrategyExecutor.execute(requireExisting(tagType));
    }

    @Transactional
    public void recalculateAll() {
        log.info("Tag recalculate (all) triggered");
        tagStrategyExecutor.executeAll();
    }

    /* ================================================================
       VALIDATION

       Tag types are free-form strings now, so these take over the job the
       RecordTagType enum used to do at compile time. Every admin entry point
       normalises through here, which keeps `record_tags.tag_type` values
       canonical and referentially sound against `tag_definitions`.
    ================================================================= */

    /**
     * Canonicalises a tag name and asserts a definition exists for it.
     *
     * @throws EntityNotFoundException when no such tag is defined — better a clear 404 than a
     *         silently-empty result, which is what an unvalidated name would produce.
     */
    public String requireExisting(String tagType) {
        String canonical = TagNames.canonicalize(tagType);
        if (canonical == null) {
            throw new IllegalArgumentException("Tag type must not be blank");
        }
        if (!tagDefinitionService.exists(canonical)) {
            throw new EntityNotFoundException("Unknown tag type: " + canonical);
        }
        return canonical;
    }

    /**
     * As {@link #requireExisting}, and additionally refuses tags that a {@link TagStrategy} owns.
     *
     * <p>Hand-editing an automatic tag looks like it works and then vanishes on the next scheduler
     * run, which deletes and rebuilds the whole tag. Rejecting it outright is the honest answer.
     */
    public String requireManual(String tagType) {
        String canonical = requireExisting(tagType);
        // Covers BOTH ways a tag can be automatic — a built-in strategy or an admin-authored rule.
        // Asking TagDefinitionService keeps this in step with what the admin UI shows as read-only.
        if (tagDefinitionService.isAutomatic(canonical)) {
            throw new IllegalArgumentException(
                    "Tag '" + canonical + "' is computed automatically — records added by hand would be "
                    + "erased on the next refresh. Use a manual tag instead.");
        }
        return canonical;
    }
}
