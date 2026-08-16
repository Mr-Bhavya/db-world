package com.db.dbworld.app.cinema.catalog.service.impl;

import com.db.dbworld.app.cinema.catalog.dto.RecordAutocompleteDto;
import com.db.dbworld.app.cinema.catalog.dto.SearchRecordDto;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.service.SearchService;
import com.db.dbworld.app.cinema.rail.projection.RailRecordProjection;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.hibernate.Session;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Log4j2
@Service
@RequiredArgsConstructor
public class SearchServiceImpl implements SearchService {

    private final RecordRepository recordRepository;

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Enable the {@code publicVisible} Hibernate filter so search/autocomplete only ever return
     * public records (PUBLISHED or UNLISTED) — never a DRAFT. Both queries are JPQL over
     * RecordEntity, so the filter applies to them.
     */
    private void excludeDrafts() {
        entityManager.unwrap(Session.class).enableFilter("publicVisible");
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SearchRecordDto> search(String query, Pageable pageable) {

        log.debug("search entry; query='{}', page={}, size={}",
                query, pageable.getPageNumber(), pageable.getPageSize());

        if (query == null || query.isBlank()) {
            return Page.empty(pageable);
        }

        excludeDrafts();
        return recordRepository
                .searchProjection(query.trim(), pageable)
                .map(SearchServiceImpl::toDto);
    }

    private static SearchRecordDto toDto(RailRecordProjection p) {
        return SearchRecordDto.builder()
                .id(p.getId())
                .title(p.getTitle())
                .type(p.getType())
                .tmdbId(p.getTmdbId())
                .posterPath(p.getPosterPath())
                .voteAverage(p.getVoteAverage() != null ? p.getVoteAverage() : 0.0)
                .releaseDate(p.getReleaseDate())
                .overview(p.getOverview())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<RecordAutocompleteDto> autocomplete(String query, int limit) {

        Pageable pageable = PageRequest.of(0, limit);

        if (query == null || query.isBlank()) {
            return Page.empty(pageable);
        }

        excludeDrafts();
        return recordRepository.autocomplete(query.trim(), pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<RecordAutocompleteDto> autocompleteAdmin(String query, int limit) {
        Pageable pageable = PageRequest.of(0, limit);

        if (query == null || query.isBlank()) {
            return Page.empty(pageable);
        }

        // No excludeDrafts() — admin media-linking pickers must find DRAFT/UNLISTED records too.
        return recordRepository.autocomplete(query.trim(), pageable);
    }
}