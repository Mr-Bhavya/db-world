package com.db.dbworld.app.cinema.catalog.tags.rule;

import lombok.Data;

import java.util.List;

/**
 * An admin-authored rule for which records an automatic tag should hold.
 *
 * <p>Stored as JSON on {@code tag_definitions.rule}. Every field is optional and they AND together —
 * an empty rule matches the whole published catalogue, so the UI requires at least one criterion.
 *
 * <h3>Why a structured rule and not admin-supplied SQL</h3>
 * The eight built-in tags are native SQL because they need time-decay maths. Exposing that to the
 * admin UI would mean interpolating admin input into a statement that {@code TagStrategyExecutor}
 * runs directly — an injection hole with DELETE/INSERT privileges. This is compiled into a JPA
 * {@link org.springframework.data.jpa.domain.Specification} instead, so admin input only ever arrives
 * as bound parameters and a malformed rule can't be anything worse than a rule that matches nothing.
 *
 * @see TagRuleEvaluator for how each field becomes a predicate
 */
@Data
public class TagRule {

    /**
     * Generic condition rows, ANDed together — field, operator, value, all picked from what
     * {@link FilterFieldRegistry} advertises.
     *
     * <p>This is the open-ended half of a rule: any column on RecordEntity or TmdbEntity becomes
     * filterable the moment it exists, with no code change here or in the frontend. The named fields
     * below are SHORTCUTS for the combinations asked for most often — they compile to exactly the
     * same predicates, they just spare an admin from assembling three rows to say "coming soon".
     *
     * <p>Both halves may be used at once; everything ANDs.
     */
    private List<TagCondition> conditions;

    /** "MOVIE" / "TV_SERIES", or null for both. */
    private String recordType;

    /** TMDB genre ids; a record matches if it has ANY of them. */
    private List<Long> genreIds;

    /** ISO original-language codes ("hi", "en"); a record matches if its language is any of them. */
    private List<String> languages;

    /** Minimum TMDB vote average, e.g. 7.5. */
    private Double minVoteAverage;

    /** Minimum TMDB vote count — pairs with minVoteAverage to exclude tiny sample sizes. */
    private Integer minVoteCount;

    /** Minimum TMDB popularity. */
    private Double minPopularity;

    /** Only records whose release/air date is within this many days (recent releases). */
    private Integer releasedWithinDays;

    /** Only records added to the catalogue within this many days ({@code created_at}). */
    private Integer addedWithinDays;

    /** Only records published within this many days ({@code published_at}) — "new on the site". */
    private Integer publishedWithinDays;

    /** Only records that gained a new season/episode within this many days ({@code new_content_at}). */
    private Integer newContentWithinDays;

    /**
     * Only records whose release/air date is in the FUTURE, within this many days — i.e. "coming
     * soon". Mirror of {@link #releasedWithinDays}, which looks backwards.
     *
     * <p>Pair it with {@code requiresMediaFiles = false} for a true Coming Soon rail: an upcoming
     * title added from TMDB has no media yet. Note such a record must still be PUBLISHED to appear
     * on any rail — publishing without media files is allowed precisely for this case.
     */
    private Integer releasingWithinNextDays;

    /**
     * Media-file requirement. Tri-state on purpose:
     * <ul>
     *   <li>{@code true} — only records with at least one file (actually watchable)</li>
     *   <li>{@code false} — only records with NO files. This is what makes a Coming Soon rail
     *       possible: announced but not yet available</li>
     *   <li>{@code null} — don't care</li>
     * </ul>
     */
    private Boolean requiresMediaFiles;

    /**
     * TMDB watch-provider ids; a record matches if it streams on ANY of them. Populated at ingest
     * from TMDB's {@code /watch/providers}, so this is "where TMDB says you can watch it", not
     * anything about your own library.
     *
     * <p>Common ids: 8 Netflix, 119 Prime Video, 122 Hotstar, 232 Zee5, 337 Disney+.
     * The rail-metadata endpoint serves whichever providers actually exist in your data.
     */
    private List<Long> providerIds;

    /**
     * Which kind of availability counts: FLATRATE (included with a subscription), RENT, BUY, or
     * NETWORK (the broadcaster). Defaults to FLATRATE — "streaming on Netflix" almost never means
     * "rentable on Netflix", and without this filter a rent-only title would match.
     */
    private String providerType;

    /** Region code for the provider match, e.g. "IN". Null matches any region TMDB returned. */
    private String providerRegion;

    /**
     * Which sort field decides ranking within the tag — a logical name from
     * {@code RailSortBuilder.availableFields()}, e.g. "popularity" or "publishedAt". The resulting
     * order is baked into {@code record_tags.priority}, so a rail sorted by "Smart ranking" follows it.
     */
    private String scoreBy;

    /** "ASC" or "DESC" for {@link #scoreBy}; defaults to DESC. */
    private String scoreDirection;

    /** Maximum records to hold. Caps the tag so one rule can't tag the entire catalogue. */
    private Integer limit;

    /** True when no criterion is set — such a rule would match everything, so callers reject it. */
    public boolean isEmpty() {
        boolean noConditions = conditions == null
                || conditions.stream().allMatch(c -> c == null || c.isBlank());
        return noConditions
                && recordType == null
                && (genreIds == null || genreIds.isEmpty())
                && (languages == null || languages.isEmpty())
                && (providerIds == null || providerIds.isEmpty())
                && minVoteAverage == null
                && minVoteCount == null
                && minPopularity == null
                && releasedWithinDays == null
                && releasingWithinNextDays == null
                && addedWithinDays == null
                && publishedWithinDays == null
                && newContentWithinDays == null
                // Any explicit value narrows the set — false ("not yet available") just as much as
                // true. Only null means "don't care".
                && requiresMediaFiles == null;
    }
}
