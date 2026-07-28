package com.db.dbworld.app.ipo.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
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

    /**
     * Indian IPO bidding closes on the last day around 5&nbsp;PM IST (mainboard ~5&nbsp;PM, some
     * categories 4:30&nbsp;PM). Treat at/after this IST time on the close date as "no longer open" —
     * both the source-reported status and the date-only {@link #deriveStatus} keep saying "open" on
     * the close day itself, which is why an IPO lingered as Open all evening.
     */
    public static final LocalTime CLOSE_CUTOFF_IST = LocalTime.of(17, 0);

    private IpoStatusCanonicalizer() {
    }

    /**
     * @return {@code true} once the IST close moment has passed — any day after {@code close}, or the
     * close day itself at/after {@link #CLOSE_CUTOFF_IST}. {@code false} when {@code close}/{@code nowIst}
     * is null or the close moment is still ahead. {@code nowIst} must be "now" in IST.
     */
    public static boolean isPastClose(LocalDate close, LocalDateTime nowIst) {
        if (close == null || nowIst == null) {
            return false;
        }
        LocalDate today = nowIst.toLocalDate();
        if (today.isAfter(close)) {
            return true;
        }
        return today.isEqual(close) && !nowIst.toLocalTime().isBefore(CLOSE_CUTOFF_IST);
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

    /**
     * Derives a canonical status purely from an IPO's dates — a fallback for sources that don't
     * report a status of their own (e.g. Chittorgarh's list JSON has open/close/listing dates but
     * no status field, so those IPOs would otherwise show as "Unknown"/unfilterable). Follows the
     * lifecycle in order: {@code listed} (listing date reached) → {@code closed} (past close but
     * not yet listed) → {@code open} (within the subscription window) → {@code upcoming} (before
     * open, or only a future listing date is known). {@code null} when no date lets us decide.
     *
     * <p>{@code today} should be "now" in IST (the Indian IPO calendar's zone) so the boundaries
     * flip at IST midnight — the caller supplies it rather than reading a clock here so this stays
     * a pure, testable function.
     */
    public static String deriveStatus(LocalDate open, LocalDate close, LocalDate listing, LocalDate today) {
        if (today == null) {
            return null;
        }
        if (listing != null && !listing.isAfter(today)) {
            return "listed";
        }
        if (close != null && today.isAfter(close)) {
            return "closed";
        }
        if (open != null && !today.isBefore(open) && (close == null || !today.isAfter(close))) {
            return "open";
        }
        if (open != null && today.isBefore(open)) {
            return "upcoming";
        }
        if (listing != null && listing.isAfter(today)) {
            return "upcoming";
        }
        return null;
    }
}
