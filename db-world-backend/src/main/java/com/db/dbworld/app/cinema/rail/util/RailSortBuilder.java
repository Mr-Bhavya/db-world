package com.db.dbworld.app.cinema.rail.util;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManager;
import jakarta.persistence.metamodel.Attribute;
import jakarta.persistence.metamodel.EntityType;
import jakarta.persistence.metamodel.SingularAttribute;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

import java.time.temporal.Temporal;
import java.util.Comparator;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * The sort options a rail (or a tag's default sort) can use, and the JPQL path each one resolves to.
 *
 * <h3>Fields are DISCOVERED, not hand-listed</h3>
 * The field list is built at startup from the JPA metamodel: every sortable scalar attribute of
 * {@link RecordEntity}, plus every sortable scalar attribute declared on {@link TmdbEntity},
 * reachable through the {@code tmdb} join. Add a column to either entity and it appears in the admin
 * dropdown on the next restart with no code change here and none in the frontend — the label travels
 * with it through the rail-metadata endpoint.
 *
 * <h3>Why only attributes DECLARED on TmdbEntity</h3>
 * {@code TmdbEntity} is a SINGLE_TABLE hierarchy: {@code releaseDate} lives on the movie subclass and
 * {@code firstAirDate} on the series subclass. Sorting a mixed Home rail by either would fail for
 * half its rows, which is precisely why the denormalised {@code primaryDate} column exists. So the
 * scan deliberately uses declared attributes only and never descends into subclasses.
 *
 * <h3>The two things still curated by hand</h3>
 * <ul>
 *   <li>{@link #ALIASES} — friendlier names for paths whose attribute name reads badly
 *       ({@code topRated} → {@code tmdb.weightedRating}). The raw name is then hidden as a duplicate.</li>
 *   <li>{@link #LABEL_OVERRIDES} — wording better than the auto-humanised default. Anything absent
 *       gets its name humanised ({@code publishedAt} → "Published at"), which is why a new column
 *       needs no edit at all.</li>
 * </ul>
 *
 * <h3>Special sentinel: {@code tagPriority}</h3>
 * Resolves to {@value #TAG_PRIORITY_SENTINEL} rather than a real path. {@code RailResolverImpl}
 * detects it and dispatches to dedicated queries that ORDER BY {@code record_tags.priority}, which
 * cannot be expressed as a Pageable sort over a collection join.
 */
@Log4j2
@Component
@RequiredArgsConstructor
public class RailSortBuilder {

    /** Sentinel path meaning "sort by the computed per-record tag score". */
    public static final String TAG_PRIORITY_SENTINEL = "__TAG_PRIORITY__";

    /** Logical name used for the sentinel. */
    public static final String TAG_PRIORITY = "tagPriority";

    private final EntityManager entityManager;

    /**
     * Friendlier logical names for specific paths. The underlying attribute name is suppressed so the
     * dropdown doesn't offer the same ordering twice.
     */
    private static final Map<String, String> ALIASES = Map.ofEntries(
            Map.entry("topRated",       "tmdb.weightedRating"),
            Map.entry("releaseAirDate", "tmdb.primaryDate"),
            Map.entry("tmdbUpdatedAt",  "tmdb.updatedAt")
    );

    /** Wording that beats the auto-humanised default. */
    private static final Map<String, String> LABEL_OVERRIDES = Map.ofEntries(
            Map.entry(TAG_PRIORITY,      "Smart ranking (tag score) ★"),
            Map.entry("topRated",        "Top rated (weighted)"),
            Map.entry("releaseAirDate",  "Release / air date"),
            Map.entry("tmdbUpdatedAt",   "Last TMDB update"),
            Map.entry("popularity",      "Popularity"),
            Map.entry("voteAverage",     "Rating (TMDB average)"),
            Map.entry("voteCount",       "Vote count"),
            Map.entry("publishedAt",     "Recently published (went live)"),
            Map.entry("createdAt",       "Date added (draft created)"),
            Map.entry("updatedAt",       "Last edited"),
            Map.entry("name",            "Title (A–Z)"),
            Map.entry("id",              "Record ID"),
            Map.entry("newContentAt",    "New season / episode added"),
            Map.entry("originalLanguage","Original language"),
            Map.entry("visibility",      "Visibility (draft / published)")
    );

    /**
     * Attributes that are technically orderable but meaningless to sort a rail by — long prose and
     * asset URLs. This is a DENYLIST on purpose: a newly added column is included by default, so
     * nobody has to remember to register it.
     */
    private static final Set<String> EXCLUDED = Set.of(
            "overview", "posterPath", "backdropPath", "homepage", "tagline",
            "originalTitle", "title", "newContentKind", "tmdbId"
    );

    /**
     * Back-compat for sort values stored before the combined date field existed.
     *
     * <p>RETIRABLE: run {@code db/migration/rails_normalize_legacy_sort.sql}, confirm its step-3
     * verification query returns zero rows on the live database, then delete this map and the two
     * lookups that use it. Don't delete it first — an unrecognised sort field now falls back to
     * unsorted, so a row this map still covers would silently lose its ordering rather than erroring.
     */
    private static final Map<String, String> LEGACY_ALIASES = Map.ofEntries(
            Map.entry("releaseDate",  "releaseAirDate"),
            Map.entry("firstAirDate", "releaseAirDate")
    );

    /** logical name → JPQL path. Insertion-ordered by label for a stable dropdown. */
    private Map<String, String> fieldMap = Map.of();

    @PostConstruct
    void discoverFields() {
        Map<String, String> discovered = new LinkedHashMap<>();

        // The sentinel first — it is the default for most tag rails.
        discovered.put(TAG_PRIORITY, TAG_PRIORITY_SENTINEL);

        // Curated aliases win over the raw attribute names they cover.
        discovered.putAll(ALIASES);
        Set<String> aliasedPaths = Set.copyOf(ALIASES.values());

        var metamodel = entityManager.getMetamodel();
        collectInto(discovered, aliasedPaths, metamodel.entity(RecordEntity.class), "");
        collectInto(discovered, aliasedPaths, metamodel.entity(TmdbEntity.class), "tmdb.");

        // Sort by label so the dropdown reads sensibly, keeping the sentinel pinned first.
        Map<String, String> ordered = new LinkedHashMap<>();
        ordered.put(TAG_PRIORITY, TAG_PRIORITY_SENTINEL);
        discovered.entrySet().stream()
                .filter(e -> !TAG_PRIORITY.equals(e.getKey()))
                .sorted(Comparator.comparing(e -> labelOf(e.getKey())))
                .forEach(e -> ordered.put(e.getKey(), e.getValue()));

        fieldMap = Map.copyOf(ordered);
        log.info("Rail sort fields discovered from JPA metamodel; count={}, fields={}",
                fieldMap.size(), fieldMap.keySet());
    }

    /**
     * Adds every sortable scalar attribute declared on {@code type}. Uses declared attributes so a
     * SINGLE_TABLE hierarchy never leaks subclass-only columns (see the class javadoc).
     */
    private void collectInto(Map<String, String> target, Set<String> aliasedPaths,
                            EntityType<?> type, String pathPrefix) {
        for (SingularAttribute<?, ?> attr : type.getDeclaredSingularAttributes()) {
            // Associations can't be ordered on; only plain columns and enums.
            if (attr.isAssociation()) continue;
            if (attr.getPersistentAttributeType() != Attribute.PersistentAttributeType.BASIC) continue;

            String name = attr.getName();
            if (EXCLUDED.contains(name)) continue;
            if (!isSortable(attr.getJavaType())) continue;

            String path = pathPrefix + name;
            // A curated alias already offers this ordering under a nicer name.
            if (aliasedPaths.contains(path)) continue;
            // RecordEntity wins a name clash with TmdbEntity (e.g. updatedAt) — it's the root entity.
            target.putIfAbsent(name, path);
        }
    }

    /** Types MySQL can meaningfully ORDER BY. */
    private static boolean isSortable(Class<?> t) {
        return CharSequence.class.isAssignableFrom(t)
                || Number.class.isAssignableFrom(t)
                || Temporal.class.isAssignableFrom(t)
                || Date.class.isAssignableFrom(t)
                || Boolean.class.isAssignableFrom(t)
                || Enum.class.isAssignableFrom(t)
                || t.isPrimitive();
    }

    /** One selectable sort option: the stored value plus how it reads in the admin dropdown. */
    public record SortField(String value, String label) {}

    /** Sort options for the admin dropdowns, in display order. */
    public List<SortField> availableFields() {
        return fieldMap.keySet().stream().map(f -> new SortField(f, labelOf(f))).toList();
    }

    /** Label for a field: curated wording if present, else the humanised attribute name. */
    public static String labelOf(String field) {
        String override = LABEL_OVERRIDES.get(field);
        if (override != null) return override;
        return humanize(field);
    }

    /** {@code publishedAt} → "Published at"; {@code voteCount} → "Vote count". */
    static String humanize(String camel) {
        if (camel == null || camel.isBlank()) return "";
        String spaced = camel.replaceAll("([a-z0-9])([A-Z])", "$1 $2").toLowerCase(Locale.ROOT);
        return Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
    }

    /** True when this logical name is a known sort field. */
    public boolean isKnownField(String field) {
        if (field == null || field.isBlank()) return false;
        return fieldMap.containsKey(LEGACY_ALIASES.getOrDefault(field, field));
    }

    public Sort build(String field, String direction) {

        if (field == null || field.isBlank()) {
            return Sort.unsorted();
        }

        String canonical = LEGACY_ALIASES.getOrDefault(field, field);

        // An unknown field used to be passed through as a raw JPQL path, so a typo (or a stale rail
        // referencing a since-removed column) threw PropertyReferenceException and broke the whole
        // rail at render time. Fall back to the query's natural order instead.
        String resolvedPath = fieldMap.get(canonical);
        if (resolvedPath == null) {
            log.warn("Unknown rail sort field '{}' — falling back to unsorted", field);
            return Sort.unsorted();
        }

        Sort.Direction dir = "ASC".equalsIgnoreCase(direction)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;

        return Sort.by(dir, resolvedPath);
    }

    /** True if this sort requires the special tag-priority query path. */
    public static boolean isTagPrioritySort(Sort sort) {
        return sort.stream().anyMatch(o -> TAG_PRIORITY_SENTINEL.equals(o.getProperty()));
    }
}
