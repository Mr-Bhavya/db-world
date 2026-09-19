package com.db.dbworld.app.live.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * One playable URL for a channel. A channel normally has several: the same feed carried
 * by two playlists, a backup mirror, or a URL an admin typed in by hand.
 *
 * <p>The player receives the whole ordered list, so when the first URL dies mid-stream it
 * moves to the next without the viewer leaving the page. Ordering is health first (a
 * known-good source beats an untested one), then {@code priority}, then insertion order.
 */
@Entity
@Table(schema = "db_world", name = "live_channel_source",
        uniqueConstraints = @UniqueConstraint(name = "uk_live_source_channel_url",
                columnNames = {"channel_id", "url_hash"}),
        indexes = @Index(name = "idx_live_source_channel", columnList = "channel_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LiveChannelSourceEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 36)
    private String id;

    @Column(name = "channel_id", nullable = false, length = 36)
    private String channelId;

    /** Null for a URL an admin added by hand; set when it came from a playlist refresh. */
    @Column(name = "playlist_id", length = 36)
    private String playlistId;

    @Column(nullable = false, length = 2048)
    private String url;

    /**
     * SHA-256 of {@code url}. Uniqueness of (channel, url) has to be enforced by the
     * database or every refresh would re-insert every source, but a 2048-char column
     * cannot carry a unique index within MySQL's 3072-byte key limit.
     */
    @Column(name = "url_hash", nullable = false, length = 64)
    private String urlHash;

    /**
     * Resolution this URL serves ("1080p"), lifted out of the playlist entry's name.
     *
     * <p>Per SOURCE, not per channel: iptv-org lists the same channel at several
     * qualities as separate entries sharing one tvg-id, which merge into one channel
     * with several sources.
     */
    @Column(length = 10)
    private String quality;

    /** Per-source header overrides; fall back to the playlist's when null. */
    @Column(name = "user_agent", length = 400)
    private String userAgent;

    @Column(name = "referer", length = 400)
    private String referer;

    @Column(nullable = false)
    @Builder.Default
    private int priority = 100;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private LiveHealth health = LiveHealth.UNKNOWN;

    @Column(name = "last_checked_at")
    private Instant lastCheckedAt;

    @Column(name = "last_error", length = 400)
    private String lastError;

    /** Consecutive failed probes. Reset on success; stops the prober flogging dead URLs. */
    @Column(name = "fail_count", nullable = false)
    @Builder.Default
    private int failCount = 0;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
