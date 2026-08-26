package com.db.dbworld.app.cinema.catalog.tags.entity;

import com.db.dbworld.app.cinema.catalog.tags.rule.TagRule;
import com.db.dbworld.app.cinema.catalog.tags.rule.TagRuleJsonConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Persistent configuration for each tag type.
 *
 * <p>This is the single source of truth for:
 * <ul>
 *   <li>Default sort field and direction for rails that reference this tag</li>
 *   <li>Whether the tag is active (inactive tags are skipped by the scheduler)</li>
 *   <li>The timestamp of the last scheduler run</li>
 * </ul>
 *
 * <p>How many records a tag holds is NOT configurable here — each
 * {@link com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategy} owns its own pool size,
 * because the limit is tied to that strategy's scoring formula (TOP_10 keeps 20 so a
 * limitSize=10 rail always fills). The refresh cadence lives in the Scheduler admin page,
 * which drives {@code TagScheduler} for every tag at once.
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
     * When false, {@code TagStrategyExecutor.executeAll()} skips this tag's strategy.
     *
     * <p>Records already carrying the tag KEEP it, so a rail pointing at a deactivated tag freezes
     * at its last-computed contents instead of going empty — deactivating is a safe "stop churning
     * this" switch, not a delete. Rails are deliberately NOT filtered on this flag; to empty a tag,
     * deactivate it and then clear its records from the admin UI.
     *
     * <p>An explicit "Recalculate" from the admin UI still runs, regardless of this flag.
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
     * Optional admin-authored rule deciding which records this tag holds, as JSON.
     *
     * <p>Null for the eight built-in tags (a {@code TagStrategy} bean computes those) and for purely
     * manual tags. When set, {@code RuleTagRefresher} recomputes membership on every scheduler run,
     * which makes the tag automatic without any code — the point of the feature.
     *
     * <p>A tag can't be both: the presence of a strategy wins, since built-in strategies encode
     * time-decay maths a structured rule can't express.
     */
    @Convert(converter = TagRuleJsonConverter.class)
    @Column(name = "rule", columnDefinition = "TEXT")
    private TagRule rule;

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
