package com.db.dbworld.app.cinema.tmdb.search.service;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.search.dto.TmdbSearchPageDto;

public interface TmdbSearchService {
    TmdbSearchPageDto search(RecordType type, String query, String language, Integer year, int page);
}
