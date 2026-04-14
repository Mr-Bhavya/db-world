package com.db.dbworld.app.cinema.rail.service.impl;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.specification.RecordSpecification;
import com.db.dbworld.app.cinema.catalog.tags.entity.TagDefinitionEntity;
import com.db.dbworld.app.cinema.catalog.tags.services.TagDefinitionService;
import com.db.dbworld.app.cinema.enums.PageType;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.rail.entity.RailEntity;
import com.db.dbworld.app.cinema.rail.entity.RailItemEntity;
import com.db.dbworld.app.cinema.rail.repository.RailItemRepository;
import com.db.dbworld.app.cinema.rail.rule.RailRule;
import com.db.dbworld.app.cinema.rail.service.RailResolver;
import com.db.dbworld.app.cinema.rail.util.RailSortBuilder;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RailResolverImpl implements RailResolver {

    private final RailItemRepository railItemRepository;
    private final RecordRepository recordRepository;
    private final TagDefinitionService tagDefinitionService;

    /**
     * Legacy resolver (non paginated).
     */
    @Override
    public List<RecordEntity> resolve(RailEntity rail) {

        int limit = rail.getLimitSize() != null ? rail.getLimitSize() : 20;
        Pageable pageable = PageRequest.of(0, limit);
        return resolveSlice(rail, pageable).getContent();
    }

    /**
     * Infinite scroll resolver.
     */
    @Override
    public Slice<RecordEntity> resolveSlice(RailEntity rail, Pageable pageable) {

        RailRule rule = rail.getRule();
        Sort sort = resolveSort(rule);

        Pageable sortedPageable = PageRequest.of(
                pageable.getPageNumber(),
                pageable.getPageSize(),
                sort
        );

        return switch (rule.getType()) {

            case "manual" -> railItemRepository
                    .findByRailIdOrderByPriorityAsc(rail.getId(), sortedPageable)
                    .map(RailItemEntity::getRecord);

            case "tag" -> {
                RecordTagType tag;
                try {
                    tag = RecordTagType.valueOf(rule.getTag().toUpperCase());
                } catch (IllegalArgumentException e) {
                    yield new SliceImpl<>(List.of(), pageable, false);
                }
                yield recordRepository.findByTag(tag, sortedPageable);
            }

            case "genre"    -> recordRepository.findByGenre(rule.getGenreId(), sortedPageable);
            case "language" -> recordRepository.findByLanguages(rule.getLanguages(), sortedPageable);

            case "filter" -> {
                Specification<RecordEntity> spec =
                        RecordSpecification.filter(rule.getField(), rule.getValue());
                yield recordRepository.findAll(spec, sortedPageable);
            }

            default -> new SliceImpl<>(List.of(), pageable, false);
        };
    }

    /**
     * ID-only resolver (no category filter).
     */
    @Override
    public Slice<Long> resolveIds(RailEntity rail, Pageable pageable) {
        return resolveIds(rail, pageable, null);
    }

    /**
     * ID-only resolver with optional category (genre) filter.
     * When category is non-null, ALL rail types additionally filter by that genre.
     */
    @Override
    public Slice<Long> resolveIds(RailEntity rail, Pageable pageable, Long category) {

        RailRule rule = rail.getRule();
        RecordType effectiveType = resolveEffectiveType(rail);
        Sort sort = resolveSort(rule);

        Pageable sortedPageable = PageRequest.of(
                pageable.getPageNumber(),
                pageable.getPageSize(),
                sort
        );

        return switch (rule.getType()) {

            case "manual" -> railItemRepository
                    .findByRailIdOrderByPriorityAsc(rail.getId(), sortedPageable)
                    .map(item -> item.getRecord().getId());

            case "tag"      -> resolveTagIds(rule, effectiveType, category, sortedPageable);
            case "genre"    -> resolveGenreIds(rule, effectiveType, category, sortedPageable);
            case "language" -> resolveLanguageIds(rule, effectiveType, category, sortedPageable);
            case "filter"   -> resolveFilterIds(rule, effectiveType, category, sortedPageable);

            default -> new SliceImpl<>(List.of(), pageable, false);
        };
    }

    /* ================================================================
       TAG RESOLUTION
    ================================================================= */

    private Slice<Long> resolveTagIds(RailRule rule, RecordType effectiveType,
                                      Long category, Pageable pageable) {

        RecordTagType tag;
        try {
            tag = RecordTagType.valueOf(rule.getTag().toUpperCase());
        } catch (IllegalArgumentException e) {
            return new SliceImpl<>(List.of(), pageable, false);
        }

        // Detect tagPriority sort — requires dedicated queries (can't sort a collection
        // join path via JPA Pageable sort).
        if (RailSortBuilder.isTagPrioritySort(pageable.getSort())) {

            boolean descending = pageable.getSort().stream()
                    .filter(o -> RailSortBuilder.TAG_PRIORITY_SENTINEL.equals(o.getProperty()))
                    .findFirst()
                    .map(o -> o.getDirection() == Sort.Direction.DESC)
                    .orElse(true);

            // Strip the sentinel sort — these queries have ORDER BY hard-coded
            Pageable unsorted = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());

            if (descending) {
                if (category != null && effectiveType != null)
                    return recordRepository.findIdsByTagAndTypeAndCategoryOrderByPriorityDesc(tag, effectiveType, category, unsorted);
                if (category != null)
                    return recordRepository.findIdsByTagAndCategoryOrderByPriorityDesc(tag, category, unsorted);
                if (effectiveType != null)
                    return recordRepository.findIdsByTagAndTypeOrderByPriorityDesc(tag, effectiveType, unsorted);
                return recordRepository.findIdsByTagOrderByPriorityDesc(tag, unsorted);
            } else {
                if (category != null && effectiveType != null)
                    return recordRepository.findIdsByTagAndTypeAndCategoryOrderByPriorityAsc(tag, effectiveType, category, unsorted);
                if (category != null)
                    return recordRepository.findIdsByTagAndCategoryOrderByPriorityAsc(tag, category, unsorted);
                if (effectiveType != null)
                    return recordRepository.findIdsByTagAndTypeOrderByPriorityAsc(tag, effectiveType, unsorted);
                return recordRepository.findIdsByTagOrderByPriorityAsc(tag, unsorted);
            }
        }

        // Standard sort path
        if (category != null) {
            return effectiveType != null
                    ? recordRepository.findIdsByTagAndTypeAndCategory(tag, effectiveType, category, pageable)
                    : recordRepository.findIdsByTagAndCategory(tag, category, pageable);
        }

        return effectiveType != null
                ? recordRepository.findIdsByTagAndType(tag, effectiveType, pageable)
                : recordRepository.findIdsByTag(tag, pageable);
    }

    /* ================================================================
       GENRE RESOLUTION
    ================================================================= */

    private Slice<Long> resolveGenreIds(RailRule rule, RecordType effectiveType,
                                        Long category, Pageable pageable) {

        Long genreId = category != null ? category : rule.getGenreId();

        return effectiveType != null
                ? recordRepository.findIdsByGenreAndType(genreId, effectiveType, pageable)
                : recordRepository.findIdsByGenre(genreId, pageable);
    }

    /* ================================================================
       LANGUAGE RESOLUTION
    ================================================================= */

    private Slice<Long> resolveLanguageIds(RailRule rule, RecordType effectiveType,
                                           Long category, Pageable pageable) {

        if (category != null) {
            return effectiveType != null
                    ? recordRepository.findIdsByLanguagesAndTypeAndCategory(rule.getLanguages(), effectiveType, category, pageable)
                    : recordRepository.findIdsByLanguagesAndCategory(rule.getLanguages(), category, pageable);
        }

        return effectiveType != null
                ? recordRepository.findIdsByLanguagesAndType(rule.getLanguages(), effectiveType, pageable)
                : recordRepository.findIdsByLanguages(rule.getLanguages(), pageable);
    }

    /* ================================================================
       FILTER RESOLUTION
    ================================================================= */

    private Slice<Long> resolveFilterIds(RailRule rule, RecordType effectiveType,
                                         Long category, Pageable pageable) {

        Specification<RecordEntity> spec =
                RecordSpecification.filter(rule.getField(), rule.getValue());

        if (effectiveType != null) spec = spec.and(RecordSpecification.hasType(effectiveType));
        if (category != null)      spec = spec.and(RecordSpecification.hasGenre(category));

        return recordRepository.findIdsBySpecification(spec, pageable);
    }

    /* ================================================================
       HELPERS
    ================================================================= */

    @Override
    public String getRuleType(RailEntity rail) {
        return rail.getRule().getType();
    }

    /**
     * Resolves the effective sort for a rail.
     *
     * <ol>
     *   <li>If {@code rule.sort} is explicitly set (non-blank), use it.</li>
     *   <li>For tag-type rails with no explicit sort, look up the
     *       {@link TagDefinitionEntity}'s {@code defaultSort} and {@code defaultDirection}.</li>
     *   <li>Fall back to unsorted.</li>
     * </ol>
     */
    private Sort resolveSort(RailRule rule) {

        // Explicit override on the rail takes precedence
        if (rule.getSort() != null && !rule.getSort().isBlank()) {
            return RailSortBuilder.build(rule.getSort(), rule.getDirection());
        }

        // For tag-type rails, inherit the default sort from TagDefinition
        if ("tag".equals(rule.getType()) && rule.getTag() != null && !rule.getTag().isBlank()) {
            TagDefinitionEntity def = tagDefinitionService.getOrDefault(rule.getTag().toUpperCase());
            if (def.getDefaultSort() != null && !def.getDefaultSort().isBlank()) {
                return RailSortBuilder.build(def.getDefaultSort(), def.getDefaultDirection());
            }
        }

        return Sort.unsorted();
    }

    /**
     * Derives the effective RecordType for filtering.
     * Priority: rule.recordType (explicit override) > rail.pageType (auto-infer).
     */
    private RecordType resolveEffectiveType(RailEntity rail) {

        RailRule rule = rail.getRule();

        if (rule.getRecordType() != null && !rule.getRecordType().isBlank()) {
            return RecordType.valueOf(rule.getRecordType().toUpperCase());
        }

        PageType pageType = rail.getPageType();
        if (pageType == null) return null;

        return switch (pageType) {
            case MOVIES -> RecordType.MOVIE;
            case SERIES -> RecordType.TV_SERIES;
            case HOME   -> null;
        };
    }
}
