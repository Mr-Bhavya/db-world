package com.db.dbworld.app.cinema.rail.service.impl;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.mapper.RecordMapper;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.rail.builder.RailRecordBuilder;
import com.db.dbworld.app.cinema.rail.cache.RailCacheService;
import com.db.dbworld.app.cinema.rail.dto.*;
import com.db.dbworld.app.cinema.rail.entity.*;
import com.db.dbworld.app.cinema.rail.mapper.RailMapper;
import com.db.dbworld.app.cinema.rail.projection.RailRecordProjection;
import com.db.dbworld.app.cinema.rail.repository.*;
import com.db.dbworld.app.cinema.rail.service.*;
import com.db.dbworld.app.cinema.tmdb.genre.dto.GenreDto;
import com.db.dbworld.app.cinema.tmdb.genre.entity.GenreEntity;
import com.db.dbworld.app.cinema.tmdb.genre.mapper.GenreMapper;
import com.db.dbworld.app.cinema.tmdb.genre.repository.GenreRepository;

import com.db.dbworld.app.cinema.enums.PageType;
import com.db.dbworld.app.cinema.enums.RecordType;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

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

    private final RailMapper railMapper;
    private final RecordMapper recordMapper;
    private final GenreMapper genreMapper;

    private static final int MAX_PAGE_SIZE = 50;

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
                ? railRepository.findByPageTypeAndActiveTrueOrderByPriorityAsc(pageType)
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
                .filter(rail -> railResolver.resolveIds(rail, probe, category).hasContent())
                .map(railMapper::toDto)
                .toList();
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
        return getRailRecords(railId, page, size, null);
    }

    @Override
    @Transactional(readOnly = true)
    public RailPageDto getRailRecords(Long railId, int page, Integer size, Long category) {

        RailEntity rail = railRepository.findById(railId)
                .orElseThrow(() -> new EntityNotFoundException("Rail not found " + railId));

        int pageSize = size != null
                ? Math.min(size, MAX_PAGE_SIZE)
                : rail.getLimitSize();

        // 1. Cache check (only for non-category requests — category changes frequently)
        if (category == null) {
            RailPageDto cached = cacheService.get(railId, page, pageSize);
            if (cached != null) return cached;
        }

        Pageable pageable = PageRequest.of(page, pageSize);

        // 2. Resolve with optional category filter
        Slice<Long> slice = railResolver.resolveIds(rail, pageable, category);

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

        // Only cache non-category results
        if (category == null) {
            cacheService.put(railId, page, pageSize, railPageDto, recordIds);
        }

        return railPageDto;
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
        RailEntity rail = railMapper.toEntity(request);
        return railMapper.toDto(railRepository.save(rail));
    }

    @Override
    public RailDto updateRail(Long railId, RailRequest request) {
        RailEntity rail = railRepository.findById(railId)
                .orElseThrow(() -> new EntityNotFoundException("Rail not found"));
        railMapper.updateEntity(request, rail);
        return railMapper.toDto(rail);
    }

    @Override
    public void deleteRail(Long railId) {
        if (!railRepository.existsById(railId))
            throw new EntityNotFoundException("Rail not found");
        railRepository.deleteById(railId);
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
