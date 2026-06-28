package com.db.dbworld.app.cinema.catalog.service.impl;

import com.db.dbworld.app.cinema.catalog.dto.RecordAdminRowDto;
import com.db.dbworld.app.cinema.catalog.dto.RecordDto;
import com.db.dbworld.app.cinema.catalog.dto.SearchRecordDto;
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
import com.db.dbworld.app.cinema.rail.projection.RailRecordProjection;
import com.db.dbworld.app.cinema.tmdb.entities.MovieTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TvSeriesTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.media.entity.ImageEntity;
import com.db.dbworld.app.cinema.tmdb.media.entity.LogoImageEntity;
import com.db.dbworld.app.cinema.tmdb.ingestion.TmdbIngestionService;
import com.db.dbworld.app.cinema.tmdb.repository.TmdbRepository;
import com.db.dbworld.app.cinema.tmdb.season.repository.SeasonRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

import org.hibernate.Session;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Log4j2
@Service
@RequiredArgsConstructor
@Transactional
public class CatalogServiceImpl implements CatalogService {

    private final RecordRepository recordRepository;
    private final TmdbRepository tmdbRepository;
    private final SeasonRepository seasonRepository;
    private final RecordTaggingService recordTaggingService;
    private final TmdbIngestionService tmdbIngestionService;
    private final ApplicationEventPublisher publisher;
    private final RecordMapper recordMapper;

    private static final String RECORD_NOT_FOUND = "Record not found: ";
    private static final String TMDB_ALREADY_EXISTS = "Record already exists for TMDB id: ";
    private static final String UNSUPPORTED_TYPE = "Unsupported record type: ";

    @PersistenceContext
    private EntityManager entityManager;

    /* ===============================
       CREATE
       =============================== */

    @Override
    public RecordDto createRecord(CreateRecordRequest request) {

        log.debug("createRecord entry; tmdbId={}, type={}", request.getTmdbId(), request.getType());

        validateTmdbUniqueness(request.getTmdbId(), null);

        TmdbEntity tmdb = ingestTmdbByType(
                request.getType(),
                request.getTmdbId(),
                tmdbIngestionService::ingestMovie,
                tmdbIngestionService::ingestTvSeries
        );

        RecordEntity record = buildRecord(request.getType(), tmdb);
        record.setHideFromRails(request.isHideFromRails());

        recordTaggingService.assignTags(record);

        RecordDto dto = saveAndMap(record);

        publishEvent(record.getId());

        log.info("Record created; recordId={}, tmdbId={}, type={}",
                record.getId(), request.getTmdbId(), request.getType());

        return dto;
    }

    @Override
    public RecordDto setHideFromRails(Long recordId, boolean hide) {
        RecordEntity record = getRecordOrThrow(recordId);
        record.setHideFromRails(hide);
        return saveAndMap(record);
    }

    /* ===============================
       UPDATE
       =============================== */

    @Override
    public RecordDto updateRecord(Long id, UpdateRecordRequest request) {

        log.debug("updateRecord entry; recordId={}, tmdbId={}, type={}",
                id, request.getTmdbId(), request.getType());

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

        log.info("Record updated; recordId={}, tmdbId={}", record.getId(), request.getTmdbId());

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
                seasonRepository.findWithEpisodesByTvShowId(tmdbId);
            }
        }

        RecordDto dto = recordMapper.toDto(record);

        // Title logo for the detail hero — selected from the loaded images
        // (locale-best: hi > en > gu > language-neutral). null → UI uses text title.
        if (record.getTmdb() != null && dto.getTmdb() != null) {
            dto.getTmdb().setLogoPath(selectLogoPath(record.getTmdb().getImages()));
        }

        return dto;
    }

    // Logo priority — Hindi first, then English, then regional (gu). null is also
    // allowed (language-neutral logo), just lowest priority.
    private static final List<String> LOGO_LOCALES = List.of("hi", "en", "gu");

    private static String selectLogoPath(List<ImageEntity> images) {
        if (images == null) return null;
        String best = null;
        int bestScore = -1;
        for (ImageEntity img : images) {
            if (!(img instanceof LogoImageEntity logo) || logo.getFilePath() == null) continue;
            int score = logoLocaleScore(logo.getIso6391());
            if (score <= 0) continue; // skip foreign-language logos — keep en/hi/gu/neutral only
            if (score > bestScore) {
                bestScore = score;
                best = logo.getFilePath();
            }
        }
        return best;
    }

    private static int logoLocaleScore(String iso) {
        if (iso == null) return 1;                       // language-neutral logo
        int idx = LOGO_LOCALES.indexOf(iso);
        return idx >= 0 ? (LOGO_LOCALES.size() - idx) * 10 : 0;  // hi > en > gu > other
    }

    /**
     * "More Like This" — returns lightweight records sharing the primary
     * genre of {@code recordId}, excluding the source record. Order matches
     * {@code RecordRepository.findIdsByGenre}'s natural ordering (popularity).
     *
     * <p>Cost: ~4 queries total (record by id, genres, ids-by-genre, rail
     * projection). Returns at most {@code limit} entries.
     */
    @Override
    @Transactional(readOnly = true)
    public List<SearchRecordDto> getSimilar(Long recordId, int limit) {
        if (limit <= 0) return List.of();

        // "More Like This" is a rail — exclude hide_from_rails records.
        entityManager.unwrap(Session.class).enableFilter("excludeHidden");

        RecordEntity record = getRecordOrThrow(recordId);
        if (record.getTmdb() == null) return List.of();

        // findByIdWithTmdb doesn't fetch genres — load them in the same session.
        Long tmdbId = record.getTmdb().getId();
        tmdbRepository.findWithGenres(tmdbId);

        var genres = record.getTmdb().getGenres();
        if (genres == null || genres.isEmpty()) return List.of();

        Long primaryGenreId = genres.get(0).getId();

        // Fetch limit+1 so excluding the source record still leaves us at
        // most `limit` results.
        Pageable pageable = PageRequest.of(0, limit + 1);
        List<Long> ids = recordRepository.findIdsByGenre(primaryGenreId, pageable)
                .getContent()
                .stream()
                .filter(id -> !id.equals(recordId))
                .limit(limit)
                .toList();

        if (ids.isEmpty()) return List.of();

        // findRailRecordProjection uses IN :ids — MySQL doesn't guarantee
        // result order matches input order, so re-sort by the original ids
        // to keep popularity ordering intact.
        List<RailRecordProjection> projections = recordRepository.findRailRecordProjection(ids);
        Map<Long, RailRecordProjection> byId = projections.stream()
                .collect(Collectors.toMap(RailRecordProjection::getId, p -> p, (a, b) -> a));

        return ids.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .map(p -> SearchRecordDto.builder()
                        .id(p.getId())
                        .title(p.getTitle())
                        .type(p.getType())
                        .tmdbId(p.getTmdbId())
                        .posterPath(p.getPosterPath())
                        .voteAverage(p.getVoteAverage() != null ? p.getVoteAverage() : 0.0)
                        .releaseDate(p.getReleaseDate())
                        .overview(p.getOverview())
                        .build())
                .toList();
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
                recordId, name, type != null ? type.name() : null, tmdbId, year, remapAdminTableSort(pageable)
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

        log.debug("deleteRecord entry; recordId={}", recordId);

        RecordEntity record = getRecordOrThrow(recordId);

        recordRepository.delete(record);

        publishEvent(recordId);

        log.info("Record deleted; recordId={}", recordId);
    }

    /* ===============================
       REFRESH
       =============================== */

    @Override
    public RecordDto refreshRecord(Long recordId) {

        log.debug("refreshRecord entry; recordId={}", recordId);

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

        log.info("Record refreshed; recordId={}, tmdbId={}", record.getId(), record.getTmdbId());

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
        if (request.getHideFromRails() != null) {
            record.setHideFromRails(request.getHideFromRails());
        }
    }

    private boolean isUnchanged(RecordEntity record, UpdateRecordRequest request) {
        boolean hideUnchanged = request.getHideFromRails() == null
                || record.isHideFromRails() == request.getHideFromRails();
        return record.getTmdb() != null &&
                Objects.equals(record.getTmdb().getId(), request.getTmdbId()) &&
                record.getType() == request.getType() &&
                hideUnchanged;
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