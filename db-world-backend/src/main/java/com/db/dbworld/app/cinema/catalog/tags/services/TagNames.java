package com.db.dbworld.app.cinema.catalog.tags.services;

import java.util.Locale;

/**
 * Naming rules for tag types.
 *
 * <p>Tag types moved from the {@code RecordTagType} enum to free-form strings so admins can create
 * their own curated tags. That removed the type system's guarantee that only a fixed set of names
 * could ever reach the database, so these rules take its place: every admin entry point funnels
 * through {@link #canonicalize}, and what lands in {@code record_tags.tag_type} /
 * {@code tag_definitions.tag_type} is always an UPPER_SNAKE slug.
 *
 * <p>Keeping one canonical form matters because rails match tags by exact string. Without it,
 * "Diwali Special", "diwali special" and "DIWALI_SPECIAL" would be three different tags that all
 * look identical in the admin UI. The human-facing text lives in {@code display_name} instead, so
 * nothing is lost by slugging the identity.
 */
public final class TagNames {

    private TagNames() {}

    /** Hard cap matching the {@code tag_type} column width in both tables. */
    public static final int MAX_LENGTH = 50;

    /**
     * Converts a display name or raw tag name into its canonical UPPER_SNAKE identity.
     *
     * <p>{@code "Diwali Special"} → {@code "DIWALI_SPECIAL"}, {@code " top-10 "} → {@code "TOP_10"}.
     * Anything that isn't a letter or digit becomes an underscore; runs collapse, and leading and
     * trailing underscores are trimmed.
     *
     * @return the canonical name, or {@code null} when the input is blank or reduces to nothing
     *         (e.g. only punctuation) — callers decide whether that is an error.
     */
    public static String canonicalize(String raw) {
        if (raw == null || raw.isBlank()) return null;

        String slug = raw.trim()
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]+", "_")
                .replaceAll("^_+|_+$", "");

        if (slug.length() > MAX_LENGTH) {
            // Re-trim: truncating mid-word can leave a dangling underscore.
            slug = slug.substring(0, MAX_LENGTH).replaceAll("_+$", "");
        }
        return slug.isEmpty() ? null : slug;
    }
}
