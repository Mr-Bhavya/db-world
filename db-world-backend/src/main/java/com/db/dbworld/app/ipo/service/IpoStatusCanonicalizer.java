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

    /** Indian IPO bidding opens ~10&nbsp;AM IST on day 1 — before that the issue is still upcoming. */
    public static final LocalTime OPEN_CUTOFF_IST = LocalTime.of(10, 0);
    /**
     * Indian IPO bidding closes on the last day around 5&nbsp;PM IST (mainboard ~5&nbsp;PM, some
     * categories 4:30&nbsp;PM). Before that on the close day the issue is still open.
     */
    public static final LocalTime CLOSE_CUTOFF_IST = LocalTime.of(17, 0);
    /** Shares list / trading opens ~10&nbsp;AM IST on the listing day — before that it isn't "listed". */
    public static final LocalTime LISTING_CUTOFF_IST = LocalTime.of(10, 0);

    private IpoStatusCanonicalizer() {
    }

    /** {@code true} once the IST moment (that day at/after {@code cutoff}, or any later day) has passed. */
    private static boolean isPastCutoff(LocalDate date, LocalDateTime nowIst, LocalTime cutoff) {
        if (date == null || nowIst == null) {
            return false;
        }
        LocalDate today = nowIst.toLocalDate();
        if (today.isAfter(date)) {
            return true;
        }
        return today.isEqual(date) && !nowIst.toLocalTime().isBefore(cutoff);
    }

    /** Whether bidding has opened (open day at/after 10&nbsp;AM IST, or later). {@code nowIst} = now in IST. */
    public static boolean isPastOpen(LocalDate open, LocalDateTime nowIst) {
        return isPastCutoff(open, nowIst, OPEN_CUTOFF_IST);
    }

    /** Whether bidding has closed (close day at/after 5&nbsp;PM IST, or later). {@code nowIst} = now in IST. */
    public static boolean isPastClose(LocalDate close, LocalDateTime nowIst) {
        return isPastCutoff(close, nowIst, CLOSE_CUTOFF_IST);
    }

    /** Whether shares have listed (listing day at/after 10&nbsp;AM IST, or later). {@code nowIst} = now in IST. */
    public static boolean isPastListing(LocalDate listing, LocalDateTime nowIst) {
        return isPastCutoff(listing, nowIst, LISTING_CUTOFF_IST);
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
    public static String deriveStatus(LocalDate open, LocalDate close, LocalDate listing, LocalDateTime nowIst) {
        if (nowIst == null) {
            return null;
        }
        if (listing != null && isPastListing(listing, nowIst)) {
            return "listed";
        }
        if (close != null && isPastClose(close, nowIst)) {
            return "closed";
        }
        if (open != null && isPastOpen(open, nowIst) && (close == null || !isPastClose(close, nowIst))) {
            return "open";
        }
        if (open != null && !isPastOpen(open, nowIst)) {
            return "upcoming";
        }
        if (listing != null && !isPastListing(listing, nowIst)) {
            return "upcoming";
        }
        return null;
    }
}
