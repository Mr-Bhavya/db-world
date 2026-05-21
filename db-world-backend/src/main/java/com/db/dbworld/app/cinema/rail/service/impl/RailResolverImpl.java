package com.db.dbworld.app.cinema.rail.service.impl;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.specification.RecordSpecification;
import com.db.dbworld.app.cinema.catalog.tags.entity.TagDefinitionEntity;
import com.db.dbworld.app.cinema.catalog.tags.services.TagDefinitionService;
import com.db.dbworld.app.cinema.enums.PageType;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.progress.repository.WatchProgressRepository;
import com.db.dbworld.audit.activity.repository.UserCinemaActivityRepository;
import com.db.dbworld.app.cinema.rail.entity.RailEntity;
import com.db.dbworld.app.cinema.rail.entity.RailItemEntity;
import com.db.dbworld.app.cinema.rail.repository.RailItemRepository;
import com.db.dbworld.app.cinema.rail.rule.RailRule;
import com.db.dbworld.app.cinema.rail.service.RailResolver;
import com.db.dbworld.app.cinema.rail.util.RailSortBuilder;
import com.db.dbworld.core.context.UserContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Log4j2
public class RailResolverImpl implements RailResolver {

    private final RailItemRepository railItemRepository;
    private final RecordRepository recordRepository;
    private final TagDefinitionService tagDefinitionService;
    private final WatchProgressRepository watchProgressRepository;
    private final UserCinemaActivityRepository activityRepository;
    private final UserContext userContext;

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
        return resolveIds(rail, pageable, null, null);
    }

    /**
     * ID-only resolver with optional category (genre) filter.
     * When category is non-null, ALL rail types additionally filter by that genre.
     */
    @Override
    public Slice<Long> resolveIds(RailEntity rail, Pageable pageable, Long category) {
        return resolveIds(rail, pageable, category, null);
    }

    /**
     * Page-aware overload. {@code requestedPage} drives type filtering for rails that
     * target more than one page (e.g. a Continue Watching rail that lives on Home, Movies,
     * and Series — same record source, page-specific type filter).
     */
    @Override
    public Slice<Long> resolveIds(RailEntity rail, Pageable pageable, Long category, PageType requestedPage) {

        RailRule rule = rail.getRule();
        RecordType effectiveType = resolveEffectiveType(rail, requestedPage);
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

            case "tag"               -> resolveTagIds(rule, effectiveType, category, sortedPageable);
            case "genre"             -> resolveGenreIds(rule, effectiveType, category, sortedPageable);
            case "language"          -> resolveLanguageIds(rule, effectiveType, category, sortedPageable);
            case "filter"            -> resolveFilterIds(rule, effectiveType, category, sortedPageable);
            case "watchlist"         -> new SliceImpl<>(List.of(), pageable, false); // resolved by RailServiceImpl
            case "continueWatching"  -> resolveContinueWatchingIds(effectiveType, pageable);
            case "becauseYouWatched" -> resolveBecauseYouWatchedIds(effectiveType, sortedPageable);

            default -> new SliceImpl<>(List.of(), pageable, false);
        };
    }

    /* ================================================================
       CONTINUE WATCHING RESOLUTION (user-scoped)
    ================================================================= */

    /**
     * "Because you watched X" — picks the user's most recent watched record (the
     * source), and returns other records sharing its primary genre. The source itself
     * is excluded so the rail doesn't recommend what the user just watched.
     *
     * <p>Sort: honors the rail's configured sort if any, otherwise falls back to the
     * rail's natural ordering (typically popularity DESC).
     */
    private Slice<Long> resolveBecauseYouWatchedIds(RecordType effectiveType, Pageable pageable) {
        // Source pick now spans BOTH watch_progress and user_cinema_activity (downloads
        // + completed streams), so users who mostly download still get a useful recommendation.
        Long sourceRecordId = pickBecauseYouWatchedSource();
        if (sourceRecordId == null) return new SliceImpl<>(List.of(), pageable, false);

        Long primaryGenreId = primaryGenreIdOf(sourceRecordId);
        if (primaryGenreId == null) return new SliceImpl<>(List.of(), pageable, false);

        Specification<RecordEntity> spec = RecordSpecification.hasGenre(primaryGenreId)
                .and((root, query, cb) -> cb.notEqual(root.get("id"), sourceRecordId));
        if (effectiveType != null) spec = spec.and(RecordSpecification.hasType(effectiveType));

        return recordRepository.findIdsBySpecification(spec, pageable);
    }

    /**
     * Resolves the source record for a "Because you watched" rail. Looks at:
     * <ol>
     *   <li>{@link WatchProgressRepository#findMostRecentRecordIdsByUser} — actual playback,</li>
     *   <li>{@link UserCinemaActivityRepository#findMostRecentRecordIdsByUser} — completed
     *       downloads/streams (covers the "user mostly downloads" use case),</li>
     * </ol>
     * and picks the most recent of the two. Returns null if neither source has data.
     */
    Long pickBecauseYouWatchedSource() {
        Long userId;
        try {
            userId = userContext.userId();
        } catch (Exception e) {
            return null;
        }
        Pageable top1 = PageRequest.of(0, 1);
        List<Long> fromProgress = watchProgressRepository.findMostRecentRecordIdsByUser(userId, top1);
        List<Long> fromActivity = activityRepository.findMostRecentRecordIdsByUser(userId, top1);
        if (!fromProgress.isEmpty()) return fromProgress.get(0);
        if (!fromActivity.isEmpty()) return fromActivity.get(0);
        return null;
    }

    /** Primary (first) genre ID for a record, or null if record/genres are missing. */
    private Long primaryGenreIdOf(Long recordId) {
        RecordEntity rec = recordRepository.findByIdWithTmdb(recordId).orElse(null);
        if (rec == null || rec.getTmdb() == null) return null;
        var genres = rec.getTmdb().getGenres();
        if (genres == null || genres.isEmpty()) return null;
        return genres.get(0).getId();
    }

    private Slice<Long> resolveContinueWatchingIds(RecordType effectiveType, Pageable pageable) {
        Long userId;
        try {
            userId = userContext.userId();
        } catch (Exception e) {
            // Unauthenticated request — return empty rather than fail.
            log.debug("Continue Watching resolution skipped: no authenticated user ({})", e.getMessage());
            return new SliceImpl<>(List.of(), pageable, false);
        }

        // GROUP BY in the query produces its own ordering; strip the Pageable sort so
        // Hibernate doesn't tack on an incompatible ORDER BY.
        Pageable unsorted = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());

        return effectiveType != null
                ? watchProgressRepository.findRecentRecordIdsByUserAndType(userId, effectiveType, unsorted)
                : watchProgressRepository.findRecentRecordIdsByUser(userId, unsorted);
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
     * Priority:
     * <ol>
     *   <li>{@code rule.recordType} (explicit override) — wins over everything.</li>
     *   <li>{@code requestedPage} — the page the caller is rendering. For multi-page rails
     *       this is the only correct source.</li>
     *   <li>The rail's first {@code pageTypes} entry when no caller context was supplied.</li>
     * </ol>
     */
    private RecordType resolveEffectiveType(RailEntity rail, PageType requestedPage) {

        RailRule rule = rail.getRule();

        if (rule != null && rule.getRecordType() != null && !rule.getRecordType().isBlank()) {
            return RecordType.valueOf(rule.getRecordType().toUpperCase());
        }

        PageType effectivePage = requestedPage;
        if (effectivePage == null && rail.getPageTypes() != null && !rail.getPageTypes().isEmpty()) {
            effectivePage = rail.getPageTypes().iterator().next();
        }
        if (effectivePage == null) return null;

        return switch (effectivePage) {
            case MOVIES -> RecordType.MOVIE;
            case SERIES -> RecordType.TV_SERIES;
            case HOME   -> null;
        };
    }
}
