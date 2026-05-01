package com.db.dbworld.app.cinema.tmdb.search.service;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.search.dto.TmdbSearchItemDto;

import java.util.List;

public interface TmdbSearchService {
    List<TmdbSearchItemDto> search(RecordType type, String query, String language, Integer year);
}
