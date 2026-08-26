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
     * Native SQL returning exactly two columns — {@code id} and {@code score} — for every record
     * that should receive this tag. {@link TagStrategyExecutor} wraps it in an
     * {@code INSERT ... SELECT} and stores {@code score} as {@code record_tags.priority}, which is
     * what a rail sorted by {@code tagPriority} orders on.
     *
     * <p>A higher score sorts first. Use a computed expression for relevance ranking, or a literal
     * when every record should rank equally:
     * <pre>
     * SELECT r.id, CAST(t.popularity AS UNSIGNED) AS score
     * FROM records r
     * JOIN tmdb_data t ON r.tmdb_id = t.id
     * WHERE t.popularity &gt;= 80
     * ORDER BY score DESC
     * LIMIT 50
     * </pre>
     *
     * <p>Cap the row count with {@code LIMIT} — the pool size belongs here, next to the formula it
     * depends on, not in configuration.
     */
    String selectSql();
}
