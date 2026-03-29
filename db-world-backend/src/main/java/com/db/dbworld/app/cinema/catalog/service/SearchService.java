package com.db.dbworld.app.cinema.catalog.service;

import com.db.dbworld.app.cinema.catalog.dto.RecordAutocompleteDto;
import com.db.dbworld.app.cinema.catalog.dto.RecordDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface SearchService {

    Page<RecordDto> search(String query, Pageable pageable);

    Page<RecordAutocompleteDto> autocomplete(String query, int limit);
}