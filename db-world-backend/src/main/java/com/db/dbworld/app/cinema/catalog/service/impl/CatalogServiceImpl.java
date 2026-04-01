package com.db.dbworld.app.cinema.catalog.service.impl;

import com.db.dbworld.app.cinema.catalog.dto.RecordAdminRowDto;
import com.db.dbworld.app.cinema.catalog.dto.RecordDto;
import com.db.dbworld.app.cinema.catalog.dto.request.AddTagRequest;
import com.db.dbworld.app.cinema.catalog.dto.request.CreateRecordRequest;
import com.db.dbworld.app.cinema.catalog.dto.request.UpdateRecordRequest;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.entities.RecordTagEntity;
import com.db.dbworld.app.cinema.catalog.mapper.RecordMapper;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.service.CatalogService;
import com.db.dbworld.app.cinema.catalog.tags.services.RecordTaggingService;
import com.db.dbworld.app.cinema.common.events.RecordChangedEvent;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.entities.MovieTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TvSeriesTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.ingestion.TmdbIngestionService;
import com.db.dbworld.app.cinema.tmdb.repository.TmdbRepository;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class CatalogServiceImpl implements CatalogService {

    private final RecordRepository recordRepository;
    private final TmdbRepository tmdbRepository;
    private final RecordTaggingService recordTaggingService;
    private final TmdbIngestionService tmdbIngestionService;
    private final ApplicationEventPublisher publisher;
    private final RecordMapper recordMapper;

    private static final String RECORD_NOT_FOUND = "Record not found: ";
    private static final String TMDB_ALREADY_EXISTS = "Record already exists for TMDB id: ";
    private static final String UNSUPPORTED_TYPE = "Unsupported record type: ";

    /* ===============================
       CREATE
       =============================== */

    @Override
    public RecordDto createRecord(CreateRecordRequest request) {

        validateTmdbUniqueness(request.getTmdbId(), null);

        TmdbEntity tmdb = ingestTmdbByType(
                request.getType(),
                request.getTmdbId(),
                tmdbIngestionService::ingestMovie,
                tmdbIngestionService::ingestTvSeries
        );

        RecordEntity record = buildRecord(request.getType(), tmdb);

        recordTaggingService.assignTags(record);

        RecordDto dto = saveAndMap(record);

        publishEvent(record.getId());

        return dto;
    }

    /* ===============================
       UPDATE
       =============================== */

    @Override
    public RecordDto updateRecord(Long id, UpdateRecordRequest request) {

        RecordEntity record = getRecordOrThrow(id);

        if (isUnchanged(record, request)) {
            return recordMapper.toDto(record);
        }

        validateTmdbUniqueness(
                request.getTmdbId(),
                record.getTmdb() != null ? record.getTmdb().getId() : null
        );

        TmdbEntity tmdb = ingestTmdbByType(
                request.getType(),
                request.getTmdbId(),
                tmdbIngestionService::ingestMovie,
                tmdbIngestionService::ingestTvSeries
        );

        updateRecordFromRequest(record, request, tmdb);

        RecordDto dto = saveAndMap(record);

        publishEvent(record.getId());

        return dto;
    }

    /* ===============================
       READ
       =============================== */

    @Override
    @Transactional(readOnly = true)
    public RecordDto getRecord(Long recordId) {
        RecordEntity record = getRecordOrThrow(recordId);

        // Pre-initialise all TMDB collections in the same session (one JOIN FETCH per
        // List bag — combining them in one query causes MultipleBagFetchException).
        // Hibernate's L1 cache reuses the same TmdbEntity instance across all queries.
        if (record.getTmdb() != null) {
            Long tmdbId = record.getTmdb().getId();
            tmdbRepository.findWithGenres(tmdbId);
            tmdbRepository.findWithVideos(tmdbId);
            tmdbRepository.findWithImages(tmdbId);
            tmdbRepository.findWithReviews(tmdbId);
            tmdbRepository.findWithProductionCompanies(tmdbId);
            tmdbRepository.findWithProductionCountries(tmdbId);
            tmdbRepository.findWithSpokenLanguages(tmdbId);
            tmdbRepository.findWithCredits(tmdbId);
            tmdbRepository.findWithProviders(tmdbId);
            if (record.getType() == RecordType.TV_SERIES) {
                tmdbRepository.findWithSeasons(tmdbId);
            }
        }

        return recordMapper.toDto(record);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RecordDto> getAllRecords() {
        return recordRepository.findAll()
                .stream()
                .map(recordMapper::toDto)
                .toList();
    }

    /* ===============================
       ADMIN TABLE
       =============================== */

    @Override
    @Transactional(readOnly = true)
    public Page<RecordAdminRowDto> getAdminTable(
            Long recordId,
            String name,
            RecordType type,
            Long tmdbId,
            Integer year,
            Pageable pageable
    ) {
        return recordRepository.findAdminTable(
                recordId, name, type, tmdbId, year, remapAdminTableSort(pageable)
        );
    }

    /**
     * Spring Data appends the table alias (r.) to sort properties in native queries.
     * Remap frontend camelCase field names to the actual snake_case column names
     * that exist in the `records r` table, so ORDER BY r.column_name is valid SQL.
     * The computed alias `year` has no real column — fall back to `id`.
     */
    private Pageable remapAdminTableSort(Pageable pageable) {
        if (!pageable.getSort().isSorted()) return pageable;
        List<Sort.Order> orders = pageable.getSort().stream()
                .map(o -> {
                    String col = switch (o.getProperty()) {
                        case "recordId"  -> "id";
                        case "tmdbId"    -> "tmdb_id";
                        case "createdAt" -> "created_at";
                        case "updatedAt" -> "updated_at";
                        case "year"      -> "id";   // computed alias; id is a reasonable proxy
                        default          -> o.getProperty();
                    };
                    return o.isAscending() ? Sort.Order.asc(col) : Sort.Order.desc(col);
                })
                .collect(Collectors.toList());
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(orders));
    }

    /* ===============================
       DELETE
       =============================== */

    @Override
    public void deleteRecord(Long recordId) {

        RecordEntity record = getRecordOrThrow(recordId);

        recordRepository.delete(record);

        publishEvent(recordId);
    }

    /* ===============================
       REFRESH
       =============================== */

    @Override
    public RecordDto refreshRecord(Long recordId) {

        RecordEntity record = getRecordOrThrow(recordId);

//        record.setTmdb(null);
//        recordRepository.save(record);

        TmdbEntity refreshed = ingestTmdbByType(
                record.getType(),
                record.getTmdbId(),
                tmdbIngestionService::refreshMovie,
                tmdbIngestionService::refreshTvSeries
        );

        record.setTmdb(refreshed);

        RecordDto dto = saveAndMap(record);

        publishEvent(record.getId());

        return dto;
    }

    /* ===============================
       TAG MANAGEMENT
       =============================== */

    @Override
    public void addTag(Long recordId, AddTagRequest request) {

        RecordEntity record = getRecordOrThrow(recordId);

        RecordTagEntity tag = RecordTagEntity.builder()
                .record(record)
                .tagType(request.getTagType())
                .priority(request.getPriority())
                .build();

        record.getTags().add(tag);

        recordRepository.save(record);

        publishEvent(recordId);
    }

    @Override
    public void removeTag(Long recordId, RecordTagType tagType) {

        RecordEntity record = getRecordOrThrow(recordId);

        record.getTags().removeIf(tag ->
                tag.getTagType().equals(tagType)
        );

        recordRepository.save(record);

        publishEvent(recordId);
    }

    /* ===============================
       HELPERS
       =============================== */

    private RecordEntity getRecordOrThrow(Long id) {
        return recordRepository.findByIdWithTmdb(id)
                .orElseThrow(() -> new EntityNotFoundException(RECORD_NOT_FOUND + id));
    }

    private void validateTmdbUniqueness(Long newTmdbId, Long currentTmdbId) {

        boolean exists = recordRepository.existsByTmdb_Id(newTmdbId);

        if (exists && !Objects.equals(newTmdbId, currentTmdbId)) {
            throw new IllegalStateException(TMDB_ALREADY_EXISTS + newTmdbId);
        }
    }

    private TmdbEntity ingestTmdbByType(
            RecordType type,
            Long tmdbId,
            Function<Long, TmdbEntity> movie,
            Function<Long, TmdbEntity> series
    ) {
        return switch (type) {
            case MOVIE -> movie.apply(tmdbId);
            case TV_SERIES -> series.apply(tmdbId);
            default -> throw new IllegalArgumentException(UNSUPPORTED_TYPE + type);
        };
    }

    private RecordEntity buildRecord(RecordType type, TmdbEntity tmdb) {
        return RecordEntity.builder()
                .name(extractTitle(tmdb))
                .type(type)
                .tmdb(tmdb)
                .build();
    }

    private void updateRecordFromRequest(
            RecordEntity record,
            UpdateRecordRequest request,
            TmdbEntity tmdb
    ) {
        record.setTmdb(tmdb);
        record.setType(request.getType());
        record.setName(extractTitle(tmdb));
    }

    private boolean isUnchanged(RecordEntity record, UpdateRecordRequest request) {
        return record.getTmdb() != null &&
                Objects.equals(record.getTmdb().getId(), request.getTmdbId()) &&
                record.getType() == request.getType();
    }

    private String extractTitle(TmdbEntity tmdb) {
        return switch (tmdb) {
            case MovieTmdbEntity movie -> movie.getTitle();
            case TvSeriesTmdbEntity series -> series.getTitle();
            case null -> throw new IllegalStateException("TMDB entity is null");
            default -> throw new IllegalStateException(
                    "Unknown TMDB entity type: " + tmdb.getClass().getSimpleName()
            );
        };
    }

    private RecordDto saveAndMap(RecordEntity record) {
        return recordMapper.toDto(recordRepository.save(record));
    }

    @Override
    public Optional<RecordEntity> getRecordEntityOptById(Long recordId) {
        return recordRepository.findById(recordId);
    }

    private void publishEvent(Long recordId) {
        publisher.publishEvent(new RecordChangedEvent(recordId));
    }
}