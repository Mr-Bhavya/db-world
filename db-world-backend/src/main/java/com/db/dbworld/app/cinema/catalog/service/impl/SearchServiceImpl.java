package com.db.dbworld.app.cinema.catalog.service.impl;

import com.db.dbworld.app.cinema.catalog.dto.RecordAutocompleteDto;
import com.db.dbworld.app.cinema.catalog.dto.SearchRecordDto;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.service.SearchService;
import com.db.dbworld.app.cinema.rail.projection.RailRecordProjection;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SearchServiceImpl implements SearchService {

    private final RecordRepository recordRepository;

    @Override
    @Transactional(readOnly = true)
    public Page<SearchRecordDto> search(String query, Pageable pageable) {

        if (query == null || query.isBlank()) {
            return Page.empty(pageable);
        }

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

        return recordRepository.autocomplete(query.trim(), pageable);
    }
}