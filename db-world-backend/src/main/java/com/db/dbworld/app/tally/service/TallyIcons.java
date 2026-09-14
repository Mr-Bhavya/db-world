package com.db.dbworld.app.tally.service;

import com.db.dbworld.app.tally.entity.TallyGroupKind;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Picks a group's icon from its name when nobody chooses one.
 *
 * <p>A default that is usually right beats an empty circle and beats making somebody choose
 * before they can get on with it. "Goa trip" is a suitcase without being asked; anyone who
 * disagrees taps it and picks another, and that choice is then stored and never second-guessed.
 *
 * <p>Resolved on the <b>server</b>, so the stored value is always a concrete icon rather than
 * "null, work it out at render time". Two clients guessing separately is two chances to guess
 * differently, and a group that looks like a suitcase on the web and a house on the phone is
 * worse than either.
 */
public final class TallyIcons {

    private TallyIcons() {}

    /** Fallbacks when the name says nothing useful. */
    public static final String DEFAULT_GROUP = "👥";
    public static final String DEFAULT_DIRECT = "🤝";
    public static final String DEFAULT_PERSONAL = "🪙";

    /**
     * Keyword to icon, most specific first.
     *
     * <p>Order matters: "road trip" should be a car rather than a suitcase, so the more
     * particular words are checked before the general ones. A {@code LinkedHashMap} literal
     * would express that too, but a list of pairs keeps the ordering obvious to the next
     * person editing it rather than depending on knowing which Map preserves insertion order.
     */
    private static final List<Map.Entry<List<String>, String>> RULES = List.of(
            Map.entry(List.of("flat", "flatmate", "roommate", "pg", "hostel"), "🏘️"),
            Map.entry(List.of("home", "house", "family", "ghar"), "🏠"),
            Map.entry(List.of("rent", "landlord"), "🔑"),
            Map.entry(List.of("road trip", "roadtrip", "drive"), "🚗"),
            Map.entry(List.of("trek", "hike", "camp"), "🏕️"),
            Map.entry(List.of("beach", "goa"), "🏖️"),
            Map.entry(List.of("trip", "travel", "tour", "vacation", "holiday", "yatra"), "🧳"),
            Map.entry(List.of("flight", "airport"), "✈️"),
            Map.entry(List.of("train", "rail"), "🚆"),
            Map.entry(List.of("office", "work", "team", "colleague"), "💼"),
            Map.entry(List.of("lunch", "dinner", "food", "restaurant", "dine"), "🍽️"),
            Map.entry(List.of("tea", "coffee", "cafe", "chai"), "☕"),
            Map.entry(List.of("party", "birthday", "celebration"), "🎉"),
            Map.entry(List.of("movie", "cinema", "concert", "show"), "🎬"),
            Map.entry(List.of("wedding", "shaadi", "marriage"), "💍"),
            Map.entry(List.of("gym", "sport", "cricket", "football"), "🏏"),
            Map.entry(List.of("grocery", "groceries", "kirana", "shopping"), "🛒"),
            Map.entry(List.of("bill", "utility", "electricity"), "🧾"),
            Map.entry(List.of("friend", "gang", "squad"), "🫂")
    );

    /**
     * The icon for a group, given whatever the user supplied.
     *
     * @param chosen  an explicit icon, or null/blank to derive one
     * @param name    the group's name, searched for a keyword
     * @param category the group's category, used when the name gives nothing
     */
    public static String resolve(String chosen, String name, String category, TallyGroupKind kind) {
        if (chosen != null && !chosen.isBlank()) {
            return chosen.trim();
        }
        String haystack = ((name == null ? "" : name) + " " + (category == null ? "" : category))
                .toLowerCase(Locale.ROOT);

        for (var rule : RULES) {
            for (String keyword : rule.getKey()) {
                if (haystack.contains(keyword)) {
                    return rule.getValue();
                }
            }
        }
        return switch (kind) {
            case DIRECT -> DEFAULT_DIRECT;
            case PERSONAL -> DEFAULT_PERSONAL;
            case GROUP -> DEFAULT_GROUP;
        };
    }
}
