package com.db.dbworld.app.live.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * A logical channel — "Al Jazeera English" — independent of how many playlists carry it
 * or how many URLs can play it. Its playable URLs live in {@link LiveChannelSourceEntity}.
 *
 * <p>Identity is {@code channelKey}: the playlist's {@code tvg-id} when present, else a
 * slug of the name. Merging on that key rather than on the stream URL is what makes
 * failover possible at all — two rows for the same channel cannot fail over to each other.
 */
@Entity
@Table(schema = "db_world", name = "live_channel",
        uniqueConstraints = @UniqueConstraint(name = "uk_live_channel_key", columnNames = "channel_key"),
        indexes = {
                @Index(name = "idx_live_channel_group",  columnList = "group_title"),
                @Index(name = "idx_live_channel_health", columnList = "health")
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LiveChannelEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 36)
    private String id;

    /** Merge key — tvg-id, else a slug of the name. Never null. */
    @Column(name = "channel_key", nullable = false, length = 200)
    private String channelKey;

    @Column(nullable = false, length = 300)
    private String name;

    /** Admin override for {@code name}; wins on display when set. */
    @Column(name = "custom_name", length = 300)
    private String customName;

    @Column(name = "tvg_id", length = 200)
    private String tvgId;

    @Column(name = "logo_url", length = 2048)
    private String logoUrl;

    /**
     * The playlist's raw {@code group-title}, verbatim. Kept as the import record only —
     * it is frequently a {@code ;}-joined LIST ("Culture;Family"), so it is not usable as
     * a category on its own. {@link #categories} is what the UI filters and groups on.
     */
    @Column(name = "group_title", length = 200)
    private String groupTitle;

    /** Admin override for {@code groupTitle}; may itself be a {@code ;}-joined list. */
    @Column(name = "custom_group", length = 200)
    private String customGroup;

    /**
     * The real categories this channel belongs to, derived from
     * {@code customGroup ?? groupTitle} at import.
     *
     * <p>Genuinely many-valued: iptv-org's 184 distinct {@code group-title} strings are
     * only 30 categories once split, and a channel tagged "Culture;Family" belongs under
     * both rather than in a combination bucket of its own.
     */
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(schema = "db_world", name = "live_channel_category",
            joinColumns = @JoinColumn(name = "channel_id"),
            indexes = @Index(name = "idx_live_channel_category", columnList = "category"))
    @Column(name = "category", nullable = false, length = 120)
    @Builder.Default
    private Set<String> categories = new LinkedHashSet<>();

    /** Admin kill-switch. A disabled channel never reaches the public list. */
    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = true;

    /** Rolled up from this channel's sources — UP when any enabled source is UP. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private LiveHealth health = LiveHealth.UNKNOWN;

    @Column(name = "last_checked_at")
    private Instant lastCheckedAt;

    /** ISO 3166-1 alpha-2, from iptv-org when known, else the tvg-id suffix. */
    @Column(length = 2)
    private String country;

    /** Display form of {@link #country} — "India" rather than "IN". */
    @Column(name = "country_name", length = 100)
    private String countryName;

    /**
     * The brand the channel belongs to: "Sony", "Zee", "Star".
     *
     * <p>Derived from the first meaningful word of the NAME, not from iptv-org's
     * {@code network}. That field covers ~13% of channels and splits the brands people
     * actually search for, so it makes a poor filter; it is kept separately in
     * {@link #network} for display only.
     */
    @Column(length = 100)
    private String brand;

    /** iptv-org's owning network, for display. Frequently null. */
    @Column(length = 150)
    private String network;

    /** Spoken languages, resolved to names ("Hindi"), from iptv-org's feed data. */
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(schema = "db_world", name = "live_channel_language",
            joinColumns = @JoinColumn(name = "channel_id"),
            indexes = @Index(name = "idx_live_channel_language", columnList = "language"))
    @Column(name = "language", nullable = false, length = 80)
    @Builder.Default
    private Set<String> languages = new LinkedHashSet<>();

    /** Lower sorts first within a group; 0 leaves it to alphabetical. */
    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;

    /** Last refresh in which some playlist still carried this channel. */
    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
