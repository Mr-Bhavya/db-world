package com.db.dbworld.app.cinema.catalog.tags.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Persistent configuration for each tag type.
 *
 * <p>This is the single source of truth for:
 * <ul>
 *   <li>Default sort field and direction for rails that reference this tag</li>
 *   <li>Pool size (max records tagged per refresh cycle)</li>
 *   <li>Whether the tag is active (inactive tags are skipped by the scheduler)</li>
 *   <li>The refresh cron expression</li>
 *   <li>The timestamp of the last scheduler run</li>
 * </ul>
 *
 * <p>Rails with rule.type="tag" inherit their default sort from this entity,
 * unless the rail provides an explicit sort override.
 */
@Entity
@Table(name = "tag_definitions", schema = "db_world")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TagDefinitionEntity {

    /**
     * Primary key — uses the {@code RecordTagType.name()} string (e.g. "TRENDING").
     */
    @Id
    @Column(name = "tag_type", length = 50, nullable = false)
    private String tagType;

    /** Human-readable label shown in the admin UI. */
    @Column(name = "display_name", length = 100, nullable = false)
    private String displayName;

    /** Optional description shown in admin hover/tooltip. */
    @Column(columnDefinition = "TEXT")
    private String description;

    /**
     * True  = tag is assigned automatically by the strategy scheduler.
     * False = tag is manually managed by admins (e.g. EDITOR_PICK).
     */
    @Column(nullable = false)
    private boolean automatic;

    /**
     * When false, the scheduler skips this tag and no rail can serve it.
     * Allows an admin to disable a tag without deleting rails that reference it.
     */
    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    /**
     * Logical sort field for rails that reference this tag.
     *
     * <p>Values correspond to keys in {@link com.db.dbworld.app.cinema.rail.util.RailSortBuilder}.
     * Use {@code "tagPriority"} to sort by the computed score stored in
     * {@code record_tags.priority}.
     */
    @Column(name = "default_sort", length = 50)
    @Builder.Default
    private String defaultSort = "popularity";

    /** Sort direction for the default sort: "ASC" or "DESC". */
    @Column(name = "default_direction", length = 10)
    @Builder.Default
    private String defaultDirection = "DESC";

    /**
     * Maximum number of records the strategy will tag per refresh cycle.
     * Mapped to the SQL LIMIT in the strategy's select query.
     */
    @Column(name = "pool_size", nullable = false)
    @Builder.Default
    private int poolSize = 30;

    /**
     * Spring cron expression for how often the scheduler should refresh this tag.
     * Null or blank means the tag uses the global default scheduler cadence.
     */
    @Column(name = "refresh_cron", length = 100)
    private String refreshCron;

    /** Timestamp of the last successful scheduler execution for this tag. */
    @Column(name = "last_refreshed_at")
    private LocalDateTime lastRefreshedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
