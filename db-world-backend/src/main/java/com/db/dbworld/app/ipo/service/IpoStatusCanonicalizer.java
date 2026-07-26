package com.db.dbworld.app.ipo.service;

import java.util.Map;

/**
 * Collapses the many different status strings each source reports (NSE says "Active"/"Listed",
 * IPO Guru and Chittorgarh have their own vocabularies) onto one canonical lowercase set —
 * {@code upcoming|open|closed|listed} — so downstream status filtering and the ingest service's
 * LISTING-transition detection (which compares against the literal {@code "listed"}) both work
 * regardless of which source's wording produced the value.
 *
 * <p>Also collapses the {@code ipoType} vocabulary ({@link #canonicalType(String)}) onto
 * {@code mainboard|sme} for the same reason — so the type filter matches regardless of a
 * source's own wording.
 */
public final class IpoStatusCanonicalizer {

    private static final Map<String, String> TYPE_ALIASES = Map.ofEntries(
            Map.entry("mainboard", "mainboard"),
            Map.entry("main board", "mainboard"),
            Map.entry("main-board", "mainboard"),
            Map.entry("mainline", "mainboard"),
            Map.entry("mb", "mainboard"),
            Map.entry("mainboard ipo", "mainboard"),
            Map.entry("eq", "mainboard"),
            Map.entry("equity", "mainboard"),

            Map.entry("sme", "sme"),
            Map.entry("sme ipo", "sme"),
            Map.entry("sme platform", "sme"),
            Map.entry("nse emerge", "sme"),
            Map.entry("bse sme", "sme")
    );

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

    /**
     * @return {@code null} for null/blank input; otherwise the canonical type ({@code mainboard}
     * or {@code sme}) for a known alias, or the lowercased/trimmed raw value unchanged if it
     * isn't recognised (never dropped).
     */
    public static String canonicalType(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalized = raw.toLowerCase().trim();
        return TYPE_ALIASES.getOrDefault(normalized, normalized);
    }
}
