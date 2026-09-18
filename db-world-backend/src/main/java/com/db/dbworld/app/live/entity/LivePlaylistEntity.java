package com.db.dbworld.app.live.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * One M3U playlist source: an http(s) URL fetched on a schedule, or an absolute local
 * path re-read on every refresh. A single source yields many channels.
 *
 * <p>Several playlists may carry the same channel. Ingestion merges them by
 * {@link LiveChannelEntity#getChannelKey()} and keeps every distinct stream URL as its
 * own {@link LiveChannelSourceEntity}, so a dead source fails over to the next one
 * instead of leaving the viewer with a black screen.
 */
@Entity
@Table(schema = "db_world", name = "live_playlist",
        indexes = @Index(name = "idx_live_playlist_enabled", columnList = "enabled"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LivePlaylistEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 36)
    private String id;

    /** Admin-facing label. Defaults to the host of the URL when left blank. */
    @Column(nullable = false, length = 120)
    private String name;

    /** http(s) URL or an absolute local path. */
    @Column(nullable = false, length = 2048)
    private String url;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = true;

    /**
     * Headers this playlist's streams need to pass their CDN's anti-hotlink check.
     * Held per playlist rather than per channel because they are a property of the
     * provider, and forwarded to the player alongside the stream URL.
     */
    @Column(name = "user_agent", length = 400)
    private String userAgent;

    @Column(name = "referer", length = 400)
    private String referer;

    /** Lower sorts first, and wins when two playlists disagree about a channel's name. */
    @Column(name = "priority", nullable = false)
    @Builder.Default
    private int priority = 100;

    @Column(name = "last_fetched_at")
    private Instant lastFetchedAt;

    /** {@code OK}, {@code ERROR}, or null when it has never been fetched. */
    @Column(name = "last_status", length = 20)
    private String lastStatus;

    @Column(name = "last_error", length = 500)
    private String lastError;

    /** Channels parsed out of this playlist on the last successful refresh. */
    @Column(name = "channel_count", nullable = false)
    @Builder.Default
    private int channelCount = 0;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
