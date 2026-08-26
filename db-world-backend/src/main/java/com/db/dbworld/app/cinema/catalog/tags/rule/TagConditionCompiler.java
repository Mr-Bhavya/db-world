package com.db.dbworld.app.cinema.catalog.tags.rule;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.tags.rule.FilterFieldRegistry.FilterField;
import com.db.dbworld.app.media.info.entity.MediaFileEntity;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.From;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Turns {@link TagCondition} rows into Criteria predicates.
 *
 * <p>Everything an admin can express goes through here, which makes it the safety boundary:
 * <ul>
 *   <li>the field must exist in {@link FilterFieldRegistry} — its JPQL path comes from the registry,
 *       never from the request, so a path can't be injected;</li>
 *   <li>the operator must be one the registry offers for that field's type;</li>
 *   <li>values become bound parameters, and a value that won't coerce to the field's type is
 *       skipped with a warning rather than blowing up the whole tag refresh.</li>
 * </ul>
 * An unusable condition is dropped, not fatal — one bad row must not stop the other tags refreshing.
 */
@Log4j2
@Component
@RequiredArgsConstructor
public class TagConditionCompiler {

    /** Ceiling on rows per rule. A tag is a shortlist; 25 ANDed joins is already pathological. */
    public static final int MAX_CONDITIONS = 25;

    private final FilterFieldRegistry registry;

    /**
     * Compiles all conditions into predicates, ANDed by the caller.
     *
     * @param joins cache of collection joins already made for this query, keyed by join path, so two
     *              conditions on the same collection reuse one join instead of multiplying rows
     */
    public List<Predicate> compile(List<TagCondition> conditions,
                                   Root<RecordEntity> root, CriteriaQuery<?> query,
                                   CriteriaBuilder cb, Map<String, From<?, ?>> joins) {
        List<Predicate> out = new ArrayList<>();
        if (conditions == null || conditions.isEmpty()) return out;

        int used = 0;
        for (TagCondition c : conditions) {
            if (c == null || c.isBlank()) continue;
            if (++used > MAX_CONDITIONS) {
                log.warn("Tag rule exceeded {} conditions — ignoring the rest", MAX_CONDITIONS);
                break;
            }

            FilterField field = registry.get(c.getField());
            if (field == null) {
                log.warn("Unknown tag-rule field '{}' — condition skipped", c.getField());
                continue;
            }
            if (!registry.supports(field, c.getOperator())) {
                log.warn("Operator '{}' is not valid for field '{}' — condition skipped",
                        c.getOperator(), c.getField());
                continue;
            }

            try {
                Predicate p = predicateFor(field, c, root, query, cb, joins);
                if (p != null) out.add(p);
            } catch (Exception e) {
                // Bad value for the field's type (e.g. "abc" for a number). Skip the row rather than
                // failing every tag in the run.
                log.warn("Tag-rule condition {} {} {} could not be compiled: {}",
                        c.getField(), c.getOperator(), c.getValue(), e.toString());
            }
        }
        return out;
    }

    private Predicate predicateFor(FilterField field, TagCondition c,
                                   Root<RecordEntity> root, CriteriaQuery<?> query,
                                   CriteriaBuilder cb, Map<String, From<?, ?>> joins) {

        // PRESENCE (media files) is an EXISTS subquery, not a join — a record with 12 files must not
        // be counted 12 times, and "has none" needs NOT EXISTS rather than an outer join + IS NULL.
        if (field.type() == FilterFieldRegistry.FilterType.PRESENCE) {
            Subquery<Long> sub = query.subquery(Long.class);
            Root<MediaFileEntity> file = sub.from(MediaFileEntity.class);
            sub.select(cb.literal(1L))
               .where(cb.equal(file.get("record").get("id"), root.get("id")));
            return "hasNone".equals(c.getOperator()) ? cb.not(cb.exists(sub)) : cb.exists(sub);
        }

        Path<?> path = resolve(field, root, query, joins);
        Class<?> javaType = path.getJavaType();

        return switch (c.getOperator()) {
            case "eq"       -> cb.equal(path, coerce(c.getValue(), javaType));
            case "ne"       -> cb.notEqual(path, coerce(c.getValue(), javaType));
            case "isSet"    -> cb.isNotNull(path);
            case "isUnset"  -> cb.isNull(path);
            case "contains" -> cb.like(cb.lower(path.as(String.class)),
                                       "%" + String.valueOf(c.getValue()).toLowerCase() + "%");
            case "in"       -> path.in(coerceAll(c.getValues(), javaType));
            case "notIn"    -> cb.not(path.in(coerceAll(c.getValues(), javaType)));
            case "gt"       -> cb.greaterThan(comparable(path), comparableValue(c.getValue(), javaType));
            case "gte"      -> cb.greaterThanOrEqualTo(comparable(path), comparableValue(c.getValue(), javaType));
            case "lt"       -> cb.lessThan(comparable(path), comparableValue(c.getValue(), javaType));
            case "lte"      -> cb.lessThanOrEqualTo(comparable(path), comparableValue(c.getValue(), javaType));
            case "withinLastDays" -> dayWindow(field, path, cb, intValue(c.getValue()), true);
            case "withinNextDays" -> dayWindow(field, path, cb, intValue(c.getValue()), false);
            default -> null;
        };
    }

    /**
     * "Within the last / next N days".
     *
     * <p>Both bounds are always applied. A one-sided comparison is the bug this method exists to
     * avoid: {@code primaryDate} is a VARCHAR, so {@code >= cutoff} alone also matches next year's
     * announcements, and a "released recently" rule quietly fills with unreleased titles.
     */
    private Predicate dayWindow(FilterField field, Path<?> path, CriteriaBuilder cb,
                                int days, boolean backwards) {
        if (days <= 0) return null;
        LocalDate today = LocalDate.now(ZoneOffset.UTC);

        if (field.type() == FilterFieldRegistry.FilterType.DATE_STRING) {
            // ISO-8601 in a VARCHAR: lexicographic order IS chronological order.
            String nowStr = today.toString();
            String bound  = (backwards ? today.minusDays(days) : today.plusDays(days)).toString();
            Expression<String> s = path.as(String.class);
            return backwards
                    ? cb.and(cb.greaterThanOrEqualTo(s, bound), cb.lessThanOrEqualTo(s, nowStr))
                    : cb.and(cb.greaterThan(s, nowStr),          cb.lessThanOrEqualTo(s, bound));
        }

        Instant now = Instant.now();
        Expression<Instant> i = path.as(Instant.class);
        return backwards
                ? cb.and(cb.greaterThanOrEqualTo(i, now.minus(days, ChronoUnit.DAYS)),
                         cb.lessThanOrEqualTo(i, now))
                : cb.and(cb.greaterThan(i, now),
                         cb.lessThanOrEqualTo(i, now.plus(days, ChronoUnit.DAYS)));
    }

    /**
     * Resolves a field to a Criteria path, creating (and caching) any collection join it needs.
     *
     * <p>The path text comes from the registry, never from admin input. Joins are cached per query so
     * two conditions on genres share one join — without that, "action AND thriller" would join twice
     * and match nothing, since a single joined row can't be both.
     */
    private Path<?> resolve(FilterField field, Root<RecordEntity> root,
                            CriteriaQuery<?> query, Map<String, From<?, ?>> joins) {

        if (field.joinPath() == null) {
            return walk(root, field.path());
        }

        From<?, ?> join = joins.get(field.joinPath());
        if (join == null) {
            From<?, ?> from = root;
            for (String seg : field.joinPath().split("\\.")) {
                from = from.join(seg);
            }
            join = from;
            joins.put(field.joinPath(), join);
            // A collection join multiplies rows; DISTINCT keeps one row per record.
            query.distinct(true);
        }
        return walk(join, field.path());
    }

    private static Path<?> walk(From<?, ?> from, String dotted) {
        Path<?> p = from;
        for (String seg : dotted.split("\\.")) {
            p = p.get(seg);
        }
        return p;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static Path<Comparable> comparable(Path<?> path) {
        return (Path<Comparable>) path;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static Comparable comparableValue(Object raw, Class<?> target) {
        Object v = coerce(raw, target);
        if (!(v instanceof Comparable cmp)) {
            throw new IllegalArgumentException("Value is not comparable: " + raw);
        }
        return cmp;
    }

    private static List<Object> coerceAll(List<Object> raw, Class<?> target) {
        if (raw == null || raw.isEmpty()) throw new IllegalArgumentException("Empty value list");
        List<Object> out = new ArrayList<>(raw.size());
        for (Object o : raw) out.add(coerce(o, target));
        return out;
    }

    /** Converts a JSON-decoded value to the column's Java type. Throws if it can't. */
    @SuppressWarnings({"unchecked", "rawtypes"})
    private static Object coerce(Object raw, Class<?> target) {
        if (raw == null) throw new IllegalArgumentException("Null value");
        String s = String.valueOf(raw).trim();
        if (s.isEmpty()) throw new IllegalArgumentException("Blank value");

        if (target == String.class)                       return s;
        if (target.isEnum())                              return Enum.valueOf((Class<Enum>) target, s.toUpperCase());
        if (target == Long.class    || target == long.class)   return Long.valueOf(s);
        if (target == Integer.class || target == int.class)    return Integer.valueOf(s);
        if (target == Double.class  || target == double.class) return Double.valueOf(s);
        if (target == Float.class   || target == float.class)  return Float.valueOf(s);
        if (target == Short.class   || target == short.class)  return Short.valueOf(s);
        if (target == Boolean.class || target == boolean.class) return Boolean.valueOf(s);
        if (target == Instant.class)                      return Instant.parse(s);
        return s;
    }

    private static int intValue(Object raw) {
        return Integer.parseInt(String.valueOf(raw).trim());
    }

    /** Shared join cache for one query. */
    public static Map<String, From<?, ?>> newJoinCache() {
        return new HashMap<>();
    }
}
