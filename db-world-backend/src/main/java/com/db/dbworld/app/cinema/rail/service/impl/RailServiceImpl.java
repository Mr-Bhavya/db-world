package com.db.dbworld.app.cinema.rail.service.impl;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.mapper.RecordMapper;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.progress.repository.WatchProgressRepository;
import com.db.dbworld.audit.activity.repository.UserCinemaActivityRepository;
import com.db.dbworld.app.cinema.rail.builder.RailRecordBuilder;
import com.db.dbworld.app.cinema.rail.cache.RailCacheService;
import com.db.dbworld.app.cinema.rail.dto.*;
import com.db.dbworld.app.cinema.rail.entity.*;
import com.db.dbworld.app.cinema.rail.mapper.RailMapper;
import com.db.dbworld.app.cinema.rail.projection.RailRecordProjection;
import com.db.dbworld.app.cinema.rail.repository.*;
import com.db.dbworld.app.cinema.interaction.enums.InteractionType;
import com.db.dbworld.app.cinema.interaction.repository.InteractionRepository;
import com.db.dbworld.app.cinema.rail.service.*;
import com.db.dbworld.app.cinema.tmdb.genre.dto.GenreDto;
import com.db.dbworld.app.cinema.tmdb.genre.entity.GenreEntity;
import com.db.dbworld.app.cinema.tmdb.genre.mapper.GenreMapper;
import com.db.dbworld.app.cinema.tmdb.genre.repository.GenreRepository;

import com.db.dbworld.app.cinema.enums.PageType;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.core.context.UserContext;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.hibernate.Session;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class RailServiceImpl implements RailService {

    private final RailRepository railRepository;
    private final RailItemRepository railItemRepository;
    private final RecordRepository recordRepository;
    private final GenreRepository genreRepository;

    private final RailResolver railResolver;
    private final RailAggregationService railAggregationService;
    private final RailCacheService cacheService;
    private final RailRecordBuilder railRecordBuilder;

    private final InteractionRepository interactionRepository;
    private final WatchProgressRepository watchProgressRepository;
    private final UserCinemaActivityRepository activityRepository;
    private final UserContext userContext;

    private final RailMapper railMapper;
    private final RecordMapper recordMapper;
    private final GenreMapper genreMapper;

    private static final int MAX_PAGE_SIZE = 50;

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Enable the "excludeHidden" Hibernate filter for the current session so all
     * subsequent record queries in this transaction skip records with
     * hide_from_rails = true. Search and admin endpoints don't call this, so
     * hidden records still surface there (e.g. 18+ titles searchable but off rails).
     */
    private void hideRailHiddenRecords() {
        entityManager.unwrap(Session.class).enableFilter("excludeHidden");
    }

    /* ---------------------------------------------------
       Categories (Genre dropdown)
    ---------------------------------------------------- */

    @Override
    @Transactional(readOnly = true)
    public List<GenreDto> getCategories(PageType pageType) {

        List<GenreEntity> genres = switch (pageType) {
            case MOVIES -> genreRepository.findActiveGenresByRecordType(RecordType.MOVIE);
            case SERIES -> genreRepository.findActiveGenresByRecordType(RecordType.TV_SERIES);
            case HOME -> genreRepository.findActiveGenres();
        };

        return genres.stream()
                .map(genreMapper::toDto)
                .toList();
    }

    /* ---------------------------------------------------
       Rails Metadata
    ---------------------------------------------------- */

    @Override
    @Transactional(readOnly = true)
    public List<RailDto> getRails(PageType pageType) {
        return getRails(pageType, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RailDto> getRails(PageType pageType, Long category) {

        List<RailEntity> rails = pageType != null
                ? railRepository.findActiveByPage(pageType)
                : railRepository.findActiveRails();

        // When a category is selected, filter out genre rails that don't match
        // (tag, language, filter rails are kept — they'll be filtered at record level)
        if (category != null) {
            rails = rails.stream()
                    .filter(rail -> isCategoryRelevant(rail, category))
                    .toList();
        }

        Pageable probe = PageRequest.of(0, 1);

        return rails.stream()
                .filter(rail -> hasContent(rail, probe, category))
                .map(railMapper::toDto)
                .map(this::applyDynamicTitle)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RailDto> getAllRails(PageType pageType) {
        // Admin endpoint — no active filter, no hasContent filter. Lets the admin UI
        // surface disabled rails (so they can be re-enabled) and brand-new rails
        // whose rule hasn't matched any records yet.
        List<RailEntity> rails = pageType != null
                ? railRepository.findAllByPageOrderByPriority(pageType)
                : railRepository.findAllOrderByPriority();
        return rails.stream().map(railMapper::toDto).toList();
    }

    /**
     * Rails like {@code becauseYouWatched} carry a per-user dynamic title — the static
     * {@code title} in the DB is used as a prefix, the source record's name gets
     * appended. Returns the dto unchanged if no source can be resolved.
     */
    private RailDto applyDynamicTitle(RailDto dto) {
        if (dto.getRule() == null || !"becauseYouWatched".equals(dto.getRule().getType())) {
            return dto;
        }
        try {
            Long userId = userContext.userId();
            Pageable top1 = PageRequest.of(0, 1);
            // Mirror the resolver's source-pick: watch_progress first, fall back to
            // user_cinema_activity so download-only users still see a useful title.
            Long sourceId = watchProgressRepository.findMostRecentRecordIdsByUser(userId, top1).stream()
                    .findFirst()
                    .orElseGet(() -> activityRepository.findMostRecentRecordIdsByUser(userId, top1).stream()
                            .findFirst().orElse(null));
            if (sourceId == null) return dto;
            recordRepository.findById(sourceId).ifPresent(source -> {
                String prefix = (dto.getTitle() == null || dto.getTitle().isBlank())
                        ? "Because you watched"
                        : dto.getTitle();
                dto.setTitle(prefix + " " + source.getName());
            });
        } catch (Exception e) {
            // Unauthenticated or lookup failure — keep the static title.
            log.debug("applyDynamicTitle: keeping static title for railId={}; reason={}",
                    dto.getId(), e.getMessage());
        }
        return dto;
    }

    private boolean hasContent(RailEntity rail, Pageable probe, Long category) {
        String ruleType = rail.getRule() != null ? rail.getRule().getType() : null;

        if ("watchlist".equals(ruleType)) {
            try {
                Long userId = userContext.userId();
                return interactionRepository.existsByUserIdAndInteractionType(userId, InteractionType.WATCHLIST);
            } catch (Exception e) {
                log.debug("hasContent watchlist check failed for railId={}; reason={}",
                        rail.getId(), e.getMessage());
                return false;
            }
        }
        if ("continueWatching".equals(ruleType)) {
            try {
                // existsByUserId alone would return true for users whose only progress
                // rows have a null recordId — the rail would render empty. Restrict to
                // entries that can actually populate the rail.
                return watchProgressRepository.existsByUserIdAndRecordIdNotNull(userContext.userId());
            } catch (Exception e) {
                log.debug("hasContent continueWatching check failed for railId={}; reason={}",
                        rail.getId(), e.getMessage());
                return false;
            }
        }
        if ("becauseYouWatched".equals(ruleType)) {
            try {
                // Mirror RailResolverImpl.pickBecauseYouWatchedSource: source can come
                // from watch_progress OR user_cinema_activity (downloads/completed streams),
                // so download-only users still get the rail.
                Long userId = userContext.userId();
                if (watchProgressRepository.existsByUserIdAndRecordIdNotNull(userId)) return true;
                return !activityRepository.findMostRecentRecordIdsByUser(userId, PageRequest.of(0, 1)).isEmpty();
            } catch (Exception e) {
                log.debug("hasContent becauseYouWatched check failed for railId={}; reason={}",
                        rail.getId(), e.getMessage());
                return false;
            }
        }
        return railResolver.resolveIds(rail, probe, category).hasContent();
    }

    /**
     * Determines whether a rail should appear when a category is selected.
     *
     * - Genre rails: only show if they match the selected category
     * - Tag / Language / Filter / Manual rails: always show (records will be filtered)
     */
    private boolean isCategoryRelevant(RailEntity rail, Long category) {

        if (rail.getRule() == null) return true;

        String type = rail.getRule().getType();

        if ("genre".equals(type)) {
            // Only show this genre rail if it matches the selected category
            Long railGenreId = rail.getRule().getGenreId();
            return category.equals(railGenreId);
        }

        // All other rail types are relevant — their records get filtered by category
        return true;
    }

    /* ---------------------------------------------------
       Rail Feed
    ---------------------------------------------------- */

    @Override
    @Transactional(readOnly = true)
    public RailPageDto getRailRecords(Long railId, int page, Integer size) {
        return getRailRecords(railId, page, size, null, null);
    }

    @Override
    @Transactional(readOnly = true)
    public RailPageDto getRailRecords(Long railId, int page, Integer size, Long category) {
        return getRailRecords(railId, page, size, category, null);
    }

    @Override
    @Transactional(readOnly = true)
    public RailPageDto getRailRecords(Long railId, int page, Integer size, Long category, PageType requestedPage) {

        log.debug("getRailRecords entry; railId={}, page={}, size={}, category={}, requestedPage={}",
                railId, page, size, category, requestedPage);

        hideRailHiddenRecords();

        RailEntity rail = railRepository.findById(railId)
                .orElseThrow(() -> new EntityNotFoundException("Rail not found " + railId));

        int pageSize = size != null
                ? Math.min(size, MAX_PAGE_SIZE)
                : rail.getLimitSize();

        // Watchlist rails are user-specific — bypass the resolver entirely
        if (rail.getRule() != null && "watchlist".equals(rail.getRule().getType())) {
            return getWatchlistRecords(userContext.userId(), page, pageSize);
        }

        // Continue Watching and Because You Watched are user-specific — skip the shared
        // cache below, but use the resolver for the ID slice. Each user gets fresh data.
        String ruleType = rail.getRule() != null ? rail.getRule().getType() : null;
        boolean userScoped = "continueWatching".equals(ruleType)
                || "becauseYouWatched".equals(ruleType);

        // 1. Cache check (only for non-category, non-user-scoped requests)
        if (category == null && !userScoped) {
            RailPageDto cached = cacheService.get(railId, page, pageSize);
            if (cached != null) return cached;
            // Cache miss on a shared (non-user-scoped) rail — useful signal for hot rails.
            log.debug("Rail cache miss; railId={}, page={}, size={}, ruleType={}",
                    railId, page, pageSize, ruleType);
        }

        Pageable pageable = PageRequest.of(page, pageSize);

        // 2. Resolve with optional category filter (page-aware for multi-page rails)
        Slice<Long> slice = railResolver.resolveIds(rail, pageable, category, requestedPage);

        List<Long> recordIds = slice.getContent();

        if (recordIds.isEmpty()) {
            return RailPageDto.builder()
                    .railId(railId)
                    .page(page)
                    .size(pageSize)
                    .hasNext(slice.hasNext())
                    .records(List.of())
                    .build();
        }

        List<RailRecordProjection> records = recordRepository.findRailRecordProjection(recordIds);

        // findRailRecordProjection uses IN :ids — MySQL does NOT guarantee the output
        // matches the input order. Re-sort the projections to honour the ordering from
        // resolveIds (which applied the rail's sort: tagPriority, createdAt, etc.).
        Map<Long, RailRecordProjection> byId = records.stream()
                .collect(Collectors.toMap(RailRecordProjection::getId, r -> r));
        List<RailRecordProjection> orderedRecords = recordIds.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .toList();

        List<Long> tmdbIds = extractTmdbIds(orderedRecords);

        if (tmdbIds.isEmpty()) {
            return buildMinimalRailPage(railId, page, pageSize, slice.hasNext(), orderedRecords);
        }

        RailAggregationResult aggregate = railAggregationService.aggregate(tmdbIds);

        // Use sequential stream — parallelStream() does not preserve encounter order.
        List<RailRecordDto> result = orderedRecords.stream()
                .map(r -> railRecordBuilder.build(
                        r, aggregate.genres(), aggregate.posters(), aggregate.backdrops(),
                        aggregate.videos(), aggregate.providers())
                ).toList();

        RailPageDto railPageDto = RailPageDto.builder()
                .railId(railId)
                .page(page)
                .size(pageSize)
                .hasNext(slice.hasNext())
                .records(result)
                .build();

        // Only cache non-category, non-user-scoped results
        if (category == null && !userScoped) {
            cacheService.put(railId, page, pageSize, railPageDto, recordIds);
        }

        return railPageDto;
    }

    /* ---------------------------------------------------
       Watchlist Rail
    ---------------------------------------------------- */

    @Override
    @Transactional(readOnly = true)
    public RailPageDto getWatchlistRecords(Long userId, int page, int size) {
        hideRailHiddenRecords();
        int pageSize = Math.min(size, MAX_PAGE_SIZE);
        org.springframework.data.domain.Page<?> interactionPage =
                interactionRepository.findByUserIdAndInteractionTypeOrderByIdDesc(
                        userId,
                        InteractionType.WATCHLIST,
                        PageRequest.of(page, pageSize)
                );

        List<Long> recordIds = interactionPage.getContent().stream()
                .map(e -> ((com.db.dbworld.app.cinema.interaction.entity.UserInteractionEntity) e).getRecord().getId())
                .toList();

        if (recordIds.isEmpty()) {
            return RailPageDto.builder()
                    .railId(null)
                    .page(page).size(pageSize)
                    .hasNext(false)
                    .records(List.of())
                    .build();
        }

        List<RailRecordProjection> projections = recordRepository.findRailRecordProjection(recordIds);

        Map<Long, RailRecordProjection> byId = projections.stream()
                .collect(Collectors.toMap(RailRecordProjection::getId, r -> r));
        List<RailRecordProjection> ordered = recordIds.stream()
                .map(byId::get).filter(Objects::nonNull).toList();

        List<Long> tmdbIds = extractTmdbIds(ordered);
        if (tmdbIds.isEmpty()) {
            return buildMinimalRailPage(null, page, pageSize, interactionPage.hasNext(), ordered);
        }

        RailAggregationResult aggregate = railAggregationService.aggregate(tmdbIds);
        List<RailRecordDto> records = ordered.stream()
                .map(r -> railRecordBuilder.build(
                        r, aggregate.genres(), aggregate.posters(),
                        aggregate.backdrops(), aggregate.videos(), aggregate.providers()))
                .toList();

        return RailPageDto.builder()
                .railId(null)
                .page(page).size(pageSize)
                .hasNext(interactionPage.hasNext())
                .records(records)
                .build();
    }

    /* ---------------------------------------------------
       Helpers
    ---------------------------------------------------- */

    private List<Long> extractTmdbIds(List<RailRecordProjection> records) {
        Set<Long> tmdbIdSet = new HashSet<>();
        for (RailRecordProjection record : records) {
            Long tmdbId = record.getTmdbId();
            if (tmdbId != null) {
                tmdbIdSet.add(tmdbId);
            }
        }
        return new ArrayList<>(tmdbIdSet);
    }

    private RailPageDto buildMinimalRailPage(Long railId, int page, int pageSize,
                                             boolean hasNext, List<RailRecordProjection> records) {
        List<RailRecordDto> minimalRecords = new ArrayList<>(records.size());
        for (RailRecordProjection record : records) {
            minimalRecords.add(railRecordBuilder.minimal(record));
        }

        return RailPageDto.builder()
                .railId(railId)
                .page(page)
                .size(pageSize)
                .hasNext(hasNext)
                .records(minimalRecords)
                .build();
    }

    /* ---------------------------------------------------
       CRUD
    ---------------------------------------------------- */

    @Override
    @Transactional(readOnly = true)
    public RailDto getRail(Long railId) {
        RailEntity rail = railRepository.findById(railId)
                .orElseThrow(() -> new EntityNotFoundException("Rail not found: " + railId));
        Pageable pageable = PageRequest.of(0, rail.getLimitSize());

        Slice<RecordEntity> slice = railResolver.resolveSlice(rail, pageable);

        RailDto dto = railMapper.toDto(rail);
        dto.setRecords(recordMapper.toDtoList(slice.getContent()));

        return dto;
    }

    @Override
    public RailDto createRail(RailRequest request) {
        log.debug("createRail entry; title={}", request != null ? request.getTitle() : null);
        RailEntity rail = railMapper.toEntity(request);
        normalizePageTypes(rail);
        RailEntity saved = railRepository.save(rail);
        log.info("Rail created; railId={}, title={}", saved.getId(), saved.getTitle());
        return railMapper.toDto(saved);
    }

    @Override
    public RailDto updateRail(Long railId, RailRequest request) {
        log.debug("updateRail entry; railId={}", railId);
        RailEntity rail = railRepository.findById(railId)
                .orElseThrow(() -> new EntityNotFoundException("Rail not found"));
        railMapper.updateEntity(request, rail);
        normalizePageTypes(rail);
        log.info("Rail updated; railId={}", railId);
        return railMapper.toDto(rail);
    }

    /** Ensures a rail always has at least one page (HOME fallback). */
    private void normalizePageTypes(RailEntity rail) {
        if (rail.getPageTypes() == null || rail.getPageTypes().isEmpty()) {
            rail.setPageTypes(java.util.EnumSet.of(PageType.HOME));
        }
    }

    @Override
    public void deleteRail(Long railId) {
        log.debug("deleteRail entry; railId={}", railId);
        if (!railRepository.existsById(railId))
            throw new EntityNotFoundException("Rail not found");
        railRepository.deleteById(railId);
        log.info("Rail deleted; railId={}", railId);
    }

    @Override
    public void addRecordToRail(Long railId, Long recordId, Integer priority) {
        if (railItemRepository.existsByRailIdAndRecordId(railId, recordId))
            throw new IllegalStateException("Record already exists");

        RailEntity rail = railRepository.getReferenceById(railId);
        RecordEntity record = recordRepository.getReferenceById(recordId);

        railItemRepository.save(
                RailItemEntity.builder()
                        .rail(rail)
                        .record(record)
                        .priority(priority)
                        .build()
        );
    }

    @Override
    public void removeRailItem(Long railItemId) {
        if (!railItemRepository.existsById(railItemId))
            throw new EntityNotFoundException("Rail item not found");
        railItemRepository.deleteById(railItemId);
    }
}
