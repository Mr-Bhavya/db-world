package com.db.dbworld.app.cinema.enums;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The BUILT-IN tags — the ones with a {@code TagStrategy} behind them, computed by the scheduler.
 *
 * <p>This is NOT the full set of tags in the system. Tags are persisted as free-form strings
 * ({@code record_tags.tag_type} / {@code tag_definitions.tag_type}) so admins can create their own
 * curated tags from the UI without a deploy. This enum exists so code that hard-codes a specific
 * built-in tag gets compile-time safety, and calls {@code .name()} at the persistence boundary.
 *
 * <p>Whether a tag is "automatic" is decided by whether a strategy is registered for it — see
 * {@code TagStrategyExecutor.managedTagTypes()} — not by membership here. A value listed here with
 * its strategy deleted becomes a manual tag.
 *
 * <p>{@code EDITOR_PICK} is the worked example: it is declared here for legacy rows and default
 * seeding, but has no strategy, so nothing ever overwrites what an admin curates into it.
 */
public enum RecordTagType {

    TRENDING,           // auto — time-decayed popularity score
    TOP_10,             // auto — top 20 by time-decayed popularity (rail shows 10)
    FEATURED,           // auto — vote_avg >= 7.5 AND popularity >= 50
    EDITOR_PICK,        // manual — admin curated, no strategy
    RECENTLY_ADDED,     // auto — added to catalog within last 30 days
    AVAILABLE_FOR_DOWNLOAD, // auto — record has at least one media file
    NEW_SEASON,         // auto — TV record that gained a brand-new season within last 30 days
    NEW_EPISODE;        // auto — TV record that gained a new episode within last 30 days

    /** Built-in tag names, for seeding and for telling built-ins apart from admin-created tags. */
    public static Set<String> builtInNames() {
        return Arrays.stream(values()).map(Enum::name).collect(Collectors.toUnmodifiableSet());
    }

    /** True when {@code name} is one of the built-ins (case-sensitive, as stored). */
    public static boolean isBuiltIn(String name) {
        return name != null && builtInNames().contains(name);
    }
}
