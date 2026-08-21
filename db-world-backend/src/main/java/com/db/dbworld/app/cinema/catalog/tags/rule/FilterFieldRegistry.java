package com.db.dbworld.app.cinema.catalog.tags.rule;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManager;
import jakarta.persistence.metamodel.Attribute;
import jakarta.persistence.metamodel.SingularAttribute;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

import java.time.temporal.Temporal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Everything a tag rule can filter on, discovered from the JPA metamodel.
 *
 * <p>This is the filter counterpart to {@code RailSortBuilder}: add a column to
 * {@link RecordEntity} or {@link TmdbEntity} and it becomes filterable in the admin UI on the next
 * restart, with no code here and none in the frontend. It exists because the original rule builder
 * had eleven hand-written criteria — so any genuinely new dimension (watch providers, "has no media
 * files") meant a backend change, which defeated the point of admin-defined tags.
 *
 * <h3>Admins never write a query</h3>
 * Each field advertises its {@link FilterType} and the operators legal for that type, so the UI can
 * render three controls — field, operator, value — and the value control can match the type. Nothing
 * is parsed from free text.
 *
 * <h3>Why this is also the security boundary</h3>
 * {@link TagRuleEvaluator} refuses any field not in this map and any operator not listed for that
 * field. Paths therefore can never come from admin input: they are looked up here and resolved
 * against the metamodel, so a hostile value can only ever be a bound parameter.
 *
 * <h3>Collections</h3>
 * One level of collection is exposed deliberately, not generically: {@code tmdb.genres},
 * {@code tmdb.providers} and {@code mediaFiles}. A blind walk over every plural attribute would
 * offer joins that produce cartesian products (credits, images, videos — thousands of rows per
 * record) and would let an admin build a query that takes the site down.
 */
@Log4j2
@Component
@RequiredArgsConstructor
public class FilterFieldRegistry {

    /** How a value should be compared, and therefore which control the UI shows. */
    public enum FilterType {
        NUMBER,       // int/long/double columns
        TEXT,         // String columns
        BOOLEAN,      // boolean columns
        ENUM,         // enum columns — the UI offers the constants
        INSTANT,      // real timestamp columns; day-window operators
        DATE_STRING,  // ISO-8601 date held in a VARCHAR (tmdb.primaryDate)
        REFERENCE,    // pick from a list of ids (genres, providers)
        PRESENCE      // has any / has none (media files)
    }

    /** One selectable operator. {@code value} is what gets stored in the rule JSON. */
    public record Operator(String value, String label) {}

    /** A pickable option for REFERENCE/ENUM fields. */
    public record Option(String value, String label) {}

    /**
     * One filterable field.
     *
     * @param value     stored in the rule; also the registry key
     * @param path      JPQL path relative to the RecordEntity root — NEVER taken from admin input
     * @param joinPath  collection to join before applying {@code path}, or null for a scalar
     */
    public record FilterField(String value, String label, FilterType type,
                              List<Operator> operators, List<Option> options,
                              String path, String joinPath) {}

    private static final Operator EQ      = new Operator("eq",      "is");
    private static final Operator NE      = new Operator("ne",      "is not");
    private static final Operator GT      = new Operator("gt",      "is greater than");
    private static final Operator GTE     = new Operator("gte",     "is at least");
    private static final Operator LT      = new Operator("lt",      "is less than");
    private static final Operator LTE     = new Operator("lte",     "is at most");
    private static final Operator CONTAINS = new Operator("contains", "contains");
    private static final Operator IN      = new Operator("in",      "is any of");
    private static final Operator NOT_IN  = new Operator("notIn",   "is none of");
    private static final Operator LAST_DAYS = new Operator("withinLastDays", "in the last N days");
    private static final Operator NEXT_DAYS = new Operator("withinNextDays", "in the next N days");
    private static final Operator IS_SET   = new Operator("isSet",   "is set");
    private static final Operator IS_UNSET = new Operator("isUnset", "is not set");
    private static final Operator HAS_ANY  = new Operator("hasAny",  "has any");
    private static final Operator HAS_NONE = new Operator("hasNone", "has none");

    private static List<Operator> operatorsFor(FilterType type) {
        return switch (type) {
            case NUMBER      -> List.of(GTE, LTE, GT, LT, EQ, NE);
            case TEXT        -> List.of(EQ, NE, CONTAINS, IN, NOT_IN, IS_SET, IS_UNSET);
            case BOOLEAN     -> List.of(EQ);
            case ENUM        -> List.of(EQ, NE, IN, NOT_IN);
            case INSTANT,
                 DATE_STRING -> List.of(LAST_DAYS, NEXT_DAYS, GTE, LTE, IS_SET, IS_UNSET);
            case REFERENCE   -> List.of(IN, NOT_IN);
            case PRESENCE    -> List.of(HAS_ANY, HAS_NONE);
        };
    }

    /** Prose and asset URLs — filterable in principle, noise in a dropdown. */
    private static final Set<String> EXCLUDED = Set.of(
            "overview", "posterPath", "backdropPath", "homepage", "tagline", "tmdbId");

    /** Wording better than the auto-humanised attribute name. */
    private static final Map<String, String> LABELS = Map.ofEntries(
            Map.entry("popularity",       "Popularity"),
            Map.entry("voteAverage",      "Rating (TMDB average)"),
            Map.entry("voteCount",        "Vote count"),
            Map.entry("primaryDate",      "Release / air date"),
            Map.entry("weightedRating",   "Top-rated score (weighted)"),
            Map.entry("originalLanguage", "Original language"),
            Map.entry("publishedAt",      "Published (went live)"),
            Map.entry("createdAt",        "Added (draft created)"),
            Map.entry("newContentAt",     "New season / episode added"),
            Map.entry("type",             "Type (movie / series)"),
            Map.entry("name",             "Title"),
            Map.entry("genres",           "Genre"),
            Map.entry("providers",        "Streaming service"),
            Map.entry("mediaFiles",       "Media files")
    );

    private final EntityManager entityManager;

    /** field value -> definition. Insertion-ordered by label for a stable dropdown. */
    private Map<String, FilterField> fields = Map.of();

    @PostConstruct
    void discoverFields() {
        List<FilterField> found = new ArrayList<>();

        var metamodel = entityManager.getMetamodel();
        collectScalars(found, metamodel.entity(RecordEntity.class), "", "");
        collectScalars(found, metamodel.entity(TmdbEntity.class), "tmdb.", "tmdb");

        // Curated relations. Deliberately not a blind walk over plural attributes — joining
        // credits/images/videos would multiply rows into the thousands per record.
        found.add(new FilterField("genre", LABELS.get("genres"), FilterType.REFERENCE,
                operatorsFor(FilterType.REFERENCE), List.of(), "id", "tmdb.genres"));
        found.add(new FilterField("provider", LABELS.get("providers"), FilterType.REFERENCE,
                operatorsFor(FilterType.REFERENCE), List.of(), "provider.id", "tmdb.providers"));
        found.add(new FilterField("mediaFiles", LABELS.get("mediaFiles"), FilterType.PRESENCE,
                operatorsFor(FilterType.PRESENCE), List.of(), null, "mediaFiles"));

        Map<String, FilterField> ordered = new LinkedHashMap<>();
        found.stream()
                .sorted(Comparator.comparing(FilterField::label))
                .forEach(f -> ordered.putIfAbsent(f.value(), f));

        fields = Map.copyOf(ordered);
        log.info("Tag-rule filter fields discovered; count={}, fields={}", fields.size(), fields.keySet());
    }

    /** Adds every filterable scalar declared on {@code type}. */
    private void collectScalars(List<FilterField> target,
                                jakarta.persistence.metamodel.EntityType<?> type,
                                String labelPrefix, String pathPrefix) {
        for (SingularAttribute<?, ?> attr : type.getDeclaredSingularAttributes()) {
            if (attr.isAssociation()) continue;
            if (attr.getPersistentAttributeType() != Attribute.PersistentAttributeType.BASIC) continue;

            String name = attr.getName();
            if (EXCLUDED.contains(name)) continue;

            FilterType ft = typeOf(attr.getJavaType(), name);
            if (ft == null) continue;

            List<Option> options = ft == FilterType.ENUM
                    ? enumOptions(attr.getJavaType())
                    : List.of();

            // Key on the bare attribute name — RecordEntity wins any clash with TmdbEntity, being
            // the root. `labelPrefix` is unused for now but keeps the two call sites symmetrical.
            String path = pathPrefix.isEmpty() ? name : pathPrefix + "." + name;
            target.add(new FilterField(name, labelOf(name), ft, operatorsFor(ft), options, path, null));
        }
    }

    /** Maps a Java type to a filter type, or null when it can't be compared meaningfully. */
    private static FilterType typeOf(Class<?> t, String attributeName) {
        // primaryDate is an ISO-8601 date stored as VARCHAR, so it wants the date operators even
        // though its Java type is String. Lexicographic comparison is chronological for that format.
        if ("primaryDate".equals(attributeName)) return FilterType.DATE_STRING;

        if (Boolean.class.isAssignableFrom(t) || t == boolean.class)      return FilterType.BOOLEAN;
        if (Enum.class.isAssignableFrom(t))                              return FilterType.ENUM;
        if (Number.class.isAssignableFrom(t) || isNumericPrimitive(t))    return FilterType.NUMBER;
        if (Temporal.class.isAssignableFrom(t) || Date.class.isAssignableFrom(t)) return FilterType.INSTANT;
        if (CharSequence.class.isAssignableFrom(t))                      return FilterType.TEXT;
        return null;
    }

    private static boolean isNumericPrimitive(Class<?> t) {
        return t == int.class || t == long.class || t == double.class
                || t == float.class || t == short.class || t == byte.class;
    }

    @SuppressWarnings("unchecked")
    private static List<Option> enumOptions(Class<?> t) {
        Object[] constants = ((Class<? extends Enum<?>>) t).getEnumConstants();
        if (constants == null) return List.of();
        List<Option> out = new ArrayList<>(constants.length);
        for (Object c : constants) {
            String n = ((Enum<?>) c).name();
            out.add(new Option(n, humanize(n.toLowerCase(Locale.ROOT))));
        }
        return out;
    }

    private static String labelOf(String name) {
        String override = LABELS.get(name);
        return override != null ? override : humanize(name);
    }

    /** {@code voteCount} / {@code vote_count} → "Vote count". */
    static String humanize(String raw) {
        if (raw == null || raw.isBlank()) return "";
        String spaced = raw.replace('_', ' ')
                .replaceAll("([a-z0-9])([A-Z])", "$1 $2")
                .toLowerCase(Locale.ROOT).trim();
        return Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
    }

    /** All filterable fields, for the admin dropdown. */
    public List<FilterField> availableFields() {
        return List.copyOf(fields.values());
    }

    /** Definition for a field name, or null when unknown — the evaluator's allowlist check. */
    public FilterField get(String field) {
        return field == null ? null : fields.get(field);
    }

    /** True when {@code operator} is legal for {@code field}. */
    public boolean supports(FilterField field, String operator) {
        return field != null && operator != null
                && field.operators().stream().anyMatch(o -> o.value().equals(operator));
    }
}
