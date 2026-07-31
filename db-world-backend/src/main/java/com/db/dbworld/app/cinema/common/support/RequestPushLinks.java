package com.db.dbworld.app.cinema.common.support;

import java.util.Map;

/**
 * Shared deep-link builder for request-update pushes (media + catalog-ingest requests). Produces the
 * {@code data} payload a tapped notification uses to route to the right screen: a cinema record
 * detail when a real record exists, otherwise a fallback to the admin requests view.
 */
public final class RequestPushLinks {

    private RequestPushLinks() {}

    /**
     * Build the push {@code data} map for a request update. When {@code recordId} is a real id
     * (&gt; 0) the map deep-links to the cinema record detail; otherwise (no record yet — e.g. a
     * dismissed or search-fulfilled catalog request) it routes to the admin requests page.
     *
     * @param recordType the record's type name ({@code "MOVIE"} / {@code "TV_SERIES"}); anything
     *                   other than a TV series is treated as a movie for the URL segment.
     */
    public static Map<String, String> recordDeepLink(Long recordId, String recordTitle, String recordType) {
        if (recordId == null || recordId <= 0) {
            return Map.of("route", "admin/requests");
        }
        String kind = "TV_SERIES".equalsIgnoreCase(recordType) ? "series" : "movie";
        String slug = slugify(recordTitle);
        String link = "/db-world/db-cinema/" + kind + "/" + recordId + (slug.isBlank() ? "" : "-" + slug);
        return Map.of("route", "record", "recordId", String.valueOf(recordId), "link", link);
    }

    /** Lowercase, hyphenate and trim a title into a URL slug. null/blank → empty string. */
    private static String slugify(String name) {
        if (name == null || name.isBlank()) {
            return "";
        }
        return name.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }
}
