package com.db.dbworld.app.cinema.rail.util;

import org.springframework.data.domain.Sort;

import java.util.Map;

/**
 * Maps logical sort field names (used in RailRule JSON) to JPQL paths.
 *
 * <p>Fields on RecordEntity are used directly.
 * Fields on TmdbEntity are prefixed with "tmdb." for JPQL joins.
 */
public class RailSortBuilder {

    /**
     * Maps logical field name → JPQL property path.
     * Add new fields here as needed.
     */
    private static final Map<String, String> FIELD_MAP = Map.of(
            // TmdbEntity fields (require join path)
            "popularity", "tmdb.popularity",
            "voteAverage", "tmdb.voteAverage",
            "voteCount", "tmdb.voteCount",
            "releaseDate", "tmdb.releaseDate",
            "firstAirDate", "tmdb.firstAirDate",

            // RecordEntity fields (direct)
            "createdAt", "createdAt",
            "updatedAt", "updatedAt",
            "name", "name",
            "id", "id"
    );

    public static Sort build(String field, String direction) {

        if (field == null || field.isBlank()) {
            return Sort.unsorted();
        }

        String resolvedPath = FIELD_MAP.getOrDefault(field, field);

        Sort.Direction dir = "ASC".equalsIgnoreCase(direction)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;

        return Sort.by(dir, resolvedPath);
    }
}
