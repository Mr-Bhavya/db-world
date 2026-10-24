package com.db.dbworld.app.cinema.tmdb.search.dto;

import java.util.List;

public record TmdbSearchPageDto(
        int page,
        int totalPages,
        int totalResults,
        List<TmdbSearchItemDto> results
) {
    public static TmdbSearchPageDto empty(int page) {
        return new TmdbSearchPageDto(page, 0, 0, List.of());
    }
}
