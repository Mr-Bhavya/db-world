package com.db.dbworld.app.ipo.source.support;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;

/**
 * Defensive date parsing shared by the JSON/HTML source adapters. Every documented source may
 * report dates as ISO-8601 ({@code 2026-07-21}) or as {@code dd-MMM-yyyy} ({@code 21-Jul-2026}) —
 * per the Phase 2 brief: try ISO first, fall back to {@code dd-MMM-yyyy}, and return {@code null}
 * on anything unparseable rather than throwing. Never fails a whole fetch over one bad date.
 */
public final class IpoDateParser {

    private static final DateTimeFormatter DD_MMM_YYYY = DateTimeFormatter.ofPattern("dd-MMM-yyyy", Locale.ENGLISH);

    private IpoDateParser() {}

    public static LocalDate parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String trimmed = raw.trim();
        try {
            return LocalDate.parse(trimmed); // ISO-8601 first
        } catch (DateTimeParseException ignored) {
            // fall through
        }
        try {
            return LocalDate.parse(trimmed, DD_MMM_YYYY);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }
}
