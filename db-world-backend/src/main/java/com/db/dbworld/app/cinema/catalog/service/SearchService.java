package com.db.dbworld.app.cinema.catalog.service;

import com.db.dbworld.app.cinema.catalog.dto.RecordAutocompleteDto;
import com.db.dbworld.app.cinema.catalog.dto.SearchRecordDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface SearchService {

    Page<SearchRecordDto> search(String query, Pageable pageable);

    Page<RecordAutocompleteDto> autocomplete(String query, int limit);

    /** Like {@link #autocomplete} but WITHOUT the draft filter — for admin record-linking pickers. */
    Page<RecordAutocompleteDto> autocompleteAdmin(String query, int limit);
}