package com.db.dbworld.app.cinema.catalog.entities;

import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.enums.RecordVisibility;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.FilterDef;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.io.Serializable;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EntityListeners(AuditingEntityListener.class)
// Rails (home / category / "more like this") show PUBLISHED only.
@FilterDef(name = "excludeHidden")
@Filter(name = "excludeHidden", condition = "visibility = 'PUBLISHED'")
// Public search + detail show anything that isn't a DRAFT (i.e. PUBLISHED or UNLISTED).
@FilterDef(name = "publicVisible")
@Filter(name = "publicVisible", condition = "visibility <> 'DRAFT'")
@Table(
        name = "records",
        schema = "db_world",
        // Low cardinality, so mainly a covering index for countByType + the admin type filter.
        indexes = @Index(name = "idx_records_type", columnList = "type")
)
public class RecordEntity implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 300)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RecordType type;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    /**
     * Direct access to TMDB ID without loading relation.
     * Useful for frontend responses and filtering.
     */
    @Column(name = "tmdb_id", insertable = false, updatable = false)
    private Long tmdbId;

    /**
     * TMDB media reference.
     *
     * IMPORTANT:
     * No cascade is used because TMDB entities are managed
     * by the TMDB ingestion service lifecycle.
     *
     * RecordEntity should NEVER delete TMDB metadata.
     */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tmdb_id", unique = true)
    private TmdbEntity tmdb;

    /**
     * Catalog tags like:
     * Trending, Top10, Featured etc.
     */
    @OneToMany(
            mappedBy = "record",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @Builder.Default
    private List<RecordTagEntity> tags = new ArrayList<>();

    /**
     * Public visibility lifecycle — DRAFT (admin-only), PUBLISHED (rails + search + detail), or
     * UNLISTED (searchable + direct link, off the rails — 18+/deep cuts). Replaces the old
     * {@code hideFromRails} boolean. New records start DRAFT so nothing is public (or pushed) until
     * an admin publishes it. The column is nullable at the DB level so the additive migration can
     * add it cleanly; the app always sets it, and a boot-time migration backfills legacy rows.
     * Enforced via the {@code excludeHidden} (rails) and {@code publicVisible} (search/detail) filters.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "visibility", length = 20)
    @Builder.Default
    private RecordVisibility visibility = RecordVisibility.DRAFT;

    /**
     * When the one-time "New on DB World" push went out (the record first became publicly playable).
     * Null until announced — the dedup marker so re-publishing or rails toggles never re-notify.
     */
    @Column(name = "new_release_notified_at")
    private Instant newReleaseNotifiedAt;

    /**
     * When this record first became PUBLISHED — i.e. when users could first see it. Stamped once, on
     * the first transition to PUBLISHED, and never overwritten (un-publishing and re-publishing keeps
     * the original date so a rail doesn't reshuffle).
     *
     * <p>This is what "newest first" on a rail should actually mean. {@code createdAt} is when the
     * DRAFT was created, which can be days or weeks earlier, and {@code tmdb.primaryDate} is the
     * title's own theatrical/air date. Exposed to rails as the {@code publishedAt} sort field.
     */
    @Column(name = "published_at")
    private Instant publishedAt;

    /**
     * When this record last gained genuinely new content (a season/episode it didn't
     * have before), set at ingest. Drives the NEW_SEASON/NEW_EPISODE tag strategies
     * (30-day window) so an old show resurfaces on rails when a new season arrives.
     * Re-uploads / quality variants of existing episodes do NOT touch this.
     */
    @Column(name = "new_content_at")
    private Instant newContentAt;

    /** "NEW_SEASON" or "NEW_EPISODE" — the kind of the most recent new-content event. */
    @Column(name = "new_content_kind", length = 20)
    private String newContentKind;

}