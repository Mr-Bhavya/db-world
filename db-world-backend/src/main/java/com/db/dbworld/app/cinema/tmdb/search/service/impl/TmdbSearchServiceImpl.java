package com.db.dbworld.app.cinema.tmdb.search.service.impl;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.client.TmdbClient;
import com.db.dbworld.app.cinema.tmdb.search.dto.SearchResponseDto;
import com.db.dbworld.app.cinema.tmdb.search.dto.TmdbSearchItemDto;
import com.db.dbworld.app.cinema.tmdb.search.service.TmdbSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.util.List;

@Log4j2
@Service
@RequiredArgsConstructor
public class TmdbSearchServiceImpl implements TmdbSearchService {

    private final TmdbClient tmdbClient;

    @Override
    public List<TmdbSearchItemDto> search(RecordType type, String query, String language, Integer year) {
        try {
            SearchResponseDto response = type == RecordType.TV_SERIES
                    ? tmdbClient.searchTv(query, language, year).block()
                    : tmdbClient.searchMovie(query, language, year).block();

            return (response != null && response.getResults() != null)
                    ? response.getResults()
                    : List.of();
        } catch (Exception e) {
            log.warn("TMDB search failed for type={} query='{}': {}", type, query, e.getMessage());
            return List.of();
        }
    }
}
