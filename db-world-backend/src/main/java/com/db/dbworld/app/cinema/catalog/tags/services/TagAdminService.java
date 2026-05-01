package com.db.dbworld.app.cinema.catalog.tags.services;

import com.db.dbworld.app.cinema.catalog.dto.RecordAdminRowDto;
import com.db.dbworld.app.cinema.catalog.dto.RecordTagDto;
import com.db.dbworld.app.cinema.catalog.dto.TagSummaryDto;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.entities.RecordTagEntity;
import com.db.dbworld.app.cinema.catalog.mapper.RecordTagMapper;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.repository.RecordTagRepository;
import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategyExecutor;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TagAdminService {

    private final RecordTagRepository tagRepository;
    private final RecordRepository recordRepository;
    private final RecordTagMapper tagMapper;
    private final TagStrategyExecutor tagStrategyExecutor;

    /**
     * Auto-managed tag types — refreshed by the scheduler via TagStrategy.
     * EDITOR_PICK now runs a strategy (quality + time-decay scoring) but admins
     * can still supplement it manually with bulk-add after a recalculate run.
     */
    private static final Set<RecordTagType> AUTO_TAGS = Set.of(
            RecordTagType.TRENDING,
            RecordTagType.TOP_10,
            RecordTagType.FEATURED,
            RecordTagType.EDITOR_PICK,
            RecordTagType.RECENTLY_ADDED,
            RecordTagType.AVAILABLE_FOR_DOWNLOAD
    );

    // ── Summary ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<TagSummaryDto> getTagSummary() {
        return Arrays.stream(RecordTagType.values())
                .map(type -> new TagSummaryDto(
                        type,
                        tagRepository.countByTagType(type),
                        AUTO_TAGS.contains(type)
                ))
                .toList();
    }

    // ── Records by tag ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<RecordAdminRowDto> getRecordsByTag(RecordTagType tagType, Pageable pageable) {
        return recordRepository.findAdminTableByTag(tagType.name(), pageable);
    }

    // ── Bulk add ─────────────────────────────────────────────────────────────

    @Transactional
    public int bulkAdd(RecordTagType tagType, List<Long> recordIds, int priority) {
        int added = 0;
        for (Long id : recordIds) {
            RecordEntity record = recordRepository.findById(id)
                    .orElseThrow(() -> new EntityNotFoundException("Record not found: " + id));
            boolean alreadyHas = record.getTags().stream()
                    .anyMatch(t -> t.getTagType() == tagType);
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
        return added;
    }

    // ── Bulk remove ──────────────────────────────────────────────────────────

    @Transactional
    public int bulkRemove(RecordTagType tagType, List<Long> recordIds) {
        int removed = 0;
        for (Long id : recordIds) {
            RecordEntity record = recordRepository.findById(id)
                    .orElseThrow(() -> new EntityNotFoundException("Record not found: " + id));
            int before = record.getTags().size();
            record.getTags().removeIf(t -> t.getTagType() == tagType);
            if (record.getTags().size() < before) {
                recordRepository.save(record);
                removed++;
            }
        }
        return removed;
    }

    // ── Single-record tag CRUD (merged from RecordTagController) ─────────────

    @Transactional
    public RecordTagDto addTagToRecord(Long recordId, RecordTagDto dto) {
        RecordEntity record = recordRepository.findById(recordId)
                .orElseThrow(() -> new EntityNotFoundException("Record not found: " + recordId));
        RecordTagEntity entity = tagMapper.toEntity(dto);
        entity.setRecord(record);
        return tagMapper.toDto(tagRepository.save(entity));
    }

    @Transactional
    public RecordTagDto updateTagPriority(Long tagId, RecordTagDto dto) {
        RecordTagEntity tag = tagRepository.findById(tagId)
                .orElseThrow(() -> new EntityNotFoundException("Tag not found: " + tagId));
        tag.setPriority(dto.getPriority());
        return tagMapper.toDto(tagRepository.save(tag));
    }

    @Transactional
    public void deleteTagEntry(Long tagId) {
        tagRepository.deleteById(tagId);
    }

    // ── Recalculate ──────────────────────────────────────────────────────────

    @Transactional
    public void recalculateOne(RecordTagType tagType) {
        tagStrategyExecutor.execute(tagType);
    }

    @Transactional
    public void recalculateAll() {
        tagStrategyExecutor.executeAll();
    }
}
