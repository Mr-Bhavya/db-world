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
     * Native SQL that returns {@code record_id} column
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
}
