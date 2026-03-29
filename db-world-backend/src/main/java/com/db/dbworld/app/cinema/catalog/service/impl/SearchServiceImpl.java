package com.db.dbworld.app.cinema.catalog.service.impl;

import com.db.dbworld.app.cinema.catalog.dto.RecordAutocompleteDto;
import com.db.dbworld.app.cinema.catalog.dto.RecordDto;
import com.db.dbworld.app.cinema.catalog.mapper.RecordMapper;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.service.SearchService;
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
    private final RecordMapper recordMapper;

    @Override
    @Transactional(readOnly = true)
    public Page<RecordDto> search(String query, Pageable pageable) {

        if (query == null || query.isBlank()) {
            return Page.empty(pageable);
        }

        return recordRepository
                .search(query.trim(), pageable)
                .map(recordMapper::toDto);
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