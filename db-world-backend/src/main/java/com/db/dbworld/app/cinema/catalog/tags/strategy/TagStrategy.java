package com.db.dbworld.app.cinema.catalog.tags.strategy;

import com.db.dbworld.app.cinema.enums.RecordTagType;

/**
 * Single-responsibility strategy for a tag type.
 *
 * <p>Each implementation encapsulates:
 * <ul>
 *     <li>Which {@link RecordTagType} it manages</li>
 *     <li>The SQL logic to bulk-insert matching records</li>
 *     <li>The priority assigned to each tagged record</li>
 * </ul>
 *
 * <p><b>Adding a new tag:</b> Create a new class that implements this interface,
 * annotate it with {@code @Component}, and it will be auto-discovered.
 */
public interface TagStrategy {

    /**
     * The tag type this strategy manages.
     */
    RecordTagType tagType();

    /**
     * Priority value assigned to records tagged by this strategy.
     * Lower = higher priority.
     */
    int priority();

    /**
     * Native SQL that returns a single {@code id} column
     * for all records that should receive this tag.
     *
     * <p>Example:
     * <pre>
     * SELECT r.id FROM records r
     * JOIN tmdb_data t ON r.tmdb_id = t.id
     * WHERE t.popularity >= 80
     * </pre>
     *
     * <p>The framework wraps this into an INSERT ... SELECT statement.
     */
    String selectSql();

    /**
     * Native SQL that returns {@code (id, score)} columns for bulk INSERT.
     *
     * <p>The {@code score} column is stored as {@code record_tags.priority},
     * which allows tag-sorted rails to order by computed relevance rather
     * than a flat constant.
     *
     * <p>The default implementation wraps {@link #selectSql()} and attaches
     * the static {@link #priority()} value as the score — meaning all records
     * for this tag get the same priority. Override this method in strategies
     * that compute per-record scores (e.g. {@code TrendingTagStrategy}).
     */
    default String selectSqlWithScore() {
        return "SELECT scored.id, " + priority() + " AS score "
                + "FROM (" + selectSql() + ") scored";
    }
}
