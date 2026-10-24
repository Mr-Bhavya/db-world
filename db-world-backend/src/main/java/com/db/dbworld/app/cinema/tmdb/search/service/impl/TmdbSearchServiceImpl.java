package com.db.dbworld.app.cinema.tmdb.search.service.impl;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.client.TmdbClient;
import com.db.dbworld.app.cinema.tmdb.search.dto.SearchResponseDto;
import com.db.dbworld.app.cinema.tmdb.search.dto.TmdbSearchPageDto;
import com.db.dbworld.app.cinema.tmdb.search.service.TmdbSearchService;
import com.db.dbworld.core.exception.DbWorldException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;

@Log4j2
@Service
@RequiredArgsConstructor
public class TmdbSearchServiceImpl implements TmdbSearchService {

    /** TMDB rejects search pages above 500. */
    private static final int MAX_PAGE = 500;

    /** Caps a user-facing search so network retries can't hold the request for a minute. */
    private static final Duration SEARCH_TIMEOUT = Duration.ofSeconds(20);

    private final TmdbClient tmdbClient;

    @Override
    public TmdbSearchPageDto search(RecordType type, String query, String language, Integer year, int page) {
        int safePage = Math.clamp(page, 1, MAX_PAGE);
        if (query == null || query.isBlank()) {
            return TmdbSearchPageDto.empty(safePage);
        }

        SearchResponseDto response;
        try {
            response = (type == RecordType.TV_SERIES
                    ? tmdbClient.searchTv(query, language, year, safePage)
                    : tmdbClient.searchMovie(query, language, year, safePage))
                    .block(SEARCH_TIMEOUT);
        } catch (Exception e) {
            log.warn("TMDB search failed for type={} query='{}' page={}: {}", type, query, safePage, e.getMessage());
            throw new DbWorldException(HttpStatus.BAD_GATEWAY, "TMDB search is temporarily unavailable. Please try again.", e);
        }

        if (response == null) {
            return TmdbSearchPageDto.empty(safePage);
        }
        return new TmdbSearchPageDto(
                response.getPage(),
                Math.min(response.getTotal_pages(), MAX_PAGE),
                response.getTotal_results(),
                response.getResults() != null ? response.getResults() : List.of()
        );
    }
}
