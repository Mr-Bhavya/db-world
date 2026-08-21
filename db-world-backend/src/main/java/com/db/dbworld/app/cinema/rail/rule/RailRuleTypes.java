package com.db.dbworld.app.cinema.rail.rule;

import java.util.List;

/**
 * The rule types a rail can use, with their admin-facing labels.
 *
 * <p>ONE list, served to the admin UI through the rail-metadata endpoint. There used to be two — a
 * five-entry list in the controller and an eight-entry list hardcoded in the frontend — while
 * {@code RailResolverImpl.resolveIds} actually handled ten. The two that appeared in neither list,
 * {@code forYou} and {@code rewatchTrending}, were fully implemented rails nobody could create.
 *
 * <p><b>Adding a rule type:</b> add the {@code case} to {@code RailResolverImpl.resolveIds} and an
 * entry here. {@code RailRuleTypesTest} fails if the two ever disagree, so the drift that hid those
 * two rails cannot recur.
 */
public final class RailRuleTypes {

    private RailRuleTypes() {}

    /** One selectable rule type. {@code value} is what lands in {@code RailRule.type}. */
    public record RuleType(String value, String label, String description) {}

    /**
     * In admin-menu order: content-driven types first, then the personalised ones, which resolve
     * per-user at request time and so look empty when previewed by an admin.
     */
    private static final List<RuleType> TYPES = List.of(
            new RuleType("tag",      "Tag",
                    "Records carrying a tag. Ordering follows the tag's score."),
            new RuleType("genre",    "Genre",
                    "Records in one TMDB genre."),
            new RuleType("language", "Language",
                    "Records in one or more original languages."),
            new RuleType("filter",   "Filter",
                    "A single field/value comparison, e.g. voteAverage >= 8."),
            new RuleType("manual",   "Manual",
                    "A hand-ordered list. Add records to the rail itself."),

            new RuleType("watchlist",         "My List (Watchlist)",
                    "Per-user: what the signed-in viewer saved."),
            new RuleType("continueWatching",  "Continue Watching",
                    "Per-user: partially watched, most recent first."),
            new RuleType("becauseYouWatched", "Because You Watched",
                    "Per-user: shares a genre with the last thing they watched."),
            new RuleType("forYou",            "Picks For You",
                    "Per-user: their most-engaged genre. Empty until they have watch history."),
            new RuleType("rewatchTrending",   "Popular Rewatches",
                    "Site-wide: most rewatched this week, from a periodic snapshot.")
    );

    public static List<RuleType> all() {
        return TYPES;
    }

    /** Just the {@code value}s — used to assert parity with the resolver's switch. */
    public static List<String> values() {
        return TYPES.stream().map(RuleType::value).toList();
    }
}
