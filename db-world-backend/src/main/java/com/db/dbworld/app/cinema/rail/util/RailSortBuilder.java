package com.db.dbworld.app.cinema.rail.util;

import org.springframework.data.domain.Sort;

import java.util.Map;
import java.util.Set;

/**
 * Maps logical sort field names (used in {@code RailRule.sort} JSON) to JPQL paths.
 *
 * <h3>Special sentinel: {@code tagPriority}</h3>
 * When the sort field is {@code "tagPriority"}, {@link #build} returns a Sort object
 * with the sentinel path {@value #TAG_PRIORITY_SENTINEL}.
 * The {@code RailResolverImpl} detects this sentinel and dispatches to dedicated
 * repository queries that ORDER BY {@code record_tags.priority} directly in JPQL
 * (which cannot be done via a pageable sort on a collection join path).
 *
 * <h3>Adding new fields</h3>
 * Add an entry to {@link #FIELD_MAP}. The key is the logical name exposed to admins
 * and stored in {@code RailRule.sort}; the value is the JPQL property path.
 */
public class RailSortBuilder {

    /**
     * Sentinel path returned by {@link #build} when the sort field is {@code "tagPriority"}.
     * The resolver handles this specially instead of passing it to JPA.
     */
    public static final String TAG_PRIORITY_SENTINEL = "__TAG_PRIORITY__";

    /**
     * Maps logical field name → JPQL property path.
     * Add new fields here as needed.
     */
    private static final Map<String, String> FIELD_MAP = Map.ofEntries(
            // TmdbEntity fields (require join path)
            Map.entry("popularity",   "tmdb.popularity"),
            Map.entry("voteAverage",  "tmdb.voteAverage"),
            Map.entry("voteCount",    "tmdb.voteCount"),
            Map.entry("releaseDate",  "tmdb.releaseDate"),
            Map.entry("firstAirDate", "tmdb.firstAirDate"),

            // RecordEntity fields (direct)
            Map.entry("createdAt", "createdAt"),
            Map.entry("updatedAt", "updatedAt"),
            Map.entry("name",      "name"),
            Map.entry("id",        "id"),

            // Tag-priority sort (sentinel — handled specially by RailResolverImpl)
            Map.entry("tagPriority", TAG_PRIORITY_SENTINEL)
    );

    /**
     * Returns the set of logical sort field names available to admins.
     * Used by the metadata endpoint to drive the dropdown in the admin UI.
     */
    public static Set<String> availableFields() {
        return FIELD_MAP.keySet();
    }

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

    /**
     * Returns true if this sort field requires the special tag-priority query path.
     */
    public static boolean isTagPrioritySort(Sort sort) {
        return sort.stream().anyMatch(o -> TAG_PRIORITY_SENTINEL.equals(o.getProperty()));
    }
}
