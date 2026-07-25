package com.db.dbworld.app.ipo.service;

import java.util.Map;

/**
 * Collapses the many different status strings each source reports (NSE says "Active"/"Listed",
 * IPO Guru and Chittorgarh have their own vocabularies) onto one canonical lowercase set —
 * {@code upcoming|open|closed|listed} — so downstream status filtering and the ingest service's
 * LISTING-transition detection (which compares against the literal {@code "listed"}) both work
 * regardless of which source's wording produced the value.
 */
public final class IpoStatusCanonicalizer {

    private static final Map<String, String> ALIASES = Map.ofEntries(
            Map.entry("open", "open"),
            Map.entry("active", "open"),
            Map.entry("live", "open"),
            Map.entry("ongoing", "open"),
            Map.entry("subscription open", "open"),

            Map.entry("upcoming", "upcoming"),
            Map.entry("forthcoming", "upcoming"),
            Map.entry("to open", "upcoming"),
            Map.entry("pre-open", "upcoming"),

            Map.entry("closed", "closed"),
            Map.entry("close", "closed"),
            Map.entry("subscription closed", "closed"),
            Map.entry("bidding closed", "closed"),

            Map.entry("listed", "listed"),
            Map.entry("listing", "listed"),
            Map.entry("listed today", "listed")
    );

    private IpoStatusCanonicalizer() {
    }

    /**
     * @return {@code null} for null/blank input; otherwise the canonical status for a known
     * alias, or the lowercased/trimmed raw value unchanged if it isn't recognised (never dropped).
     */
    public static String canonical(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalized = raw.toLowerCase().trim();
        return ALIASES.getOrDefault(normalized, normalized);
    }
}
