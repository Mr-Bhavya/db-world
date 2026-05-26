package com.db.dbworld.audit.activity.entity;

import com.db.dbworld.core.user.entity.UserEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@Entity
@EntityListeners(AuditingEntityListener.class)
@Table(name = "USER_CINEMA_ACTIVITY",
        indexes = {
                @Index(name = "idx_session_id",        columnList = "sessionId"),
                @Index(name = "idx_activity_type",     columnList = "activityType"),
                @Index(name = "idx_user_activity",     columnList = "user_id, lastUpdated"),
                @Index(name = "idx_uca_record_type",   columnList = "record_id, activityType, lastUpdated"),
                @Index(name = "idx_uca_media_file",    columnList = "media_file_id"),
                @Index(name = "idx_uca_user_completed",columnList = "user_id, completion_status, lastUpdated"),
        },
        uniqueConstraints = {
                /*
                 * Canonical key per (user, file, type) — a single row aggregates all
                 * connections, retries, and re-resolves for the same logical session.
                 * Multi-connection downloaders (aria2, IDM) increment counters on this
                 * row via INSERT ... ON DUPLICATE KEY UPDATE instead of spawning dupes.
                 */
                @UniqueConstraint(
                        name = "uk_user_file_activity",
                        columnNames = {"user_id", "file_path", "activity_type"}
                )
        })
public class UserCinemaActivityEntity {

    public enum ActivityType {
        DOWNLOAD,
        STREAM,
        SEARCH
    }

    public enum CompletionStatus {
        STARTED,
        IN_PROGRESS,
        COMPLETED,
        ABORTED
    }

    public enum ClientType {
        BROWSER,
        ARIA2,
        IDM,
        WGET,
        CURL,
        VLC,
        MPV,
        KODI,
        UNKNOWN
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, name = "activity_type", length = 16)
    private ActivityType activityType;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String activityValue;  // download/stream file path, search keyword

    @Column(nullable = false)
    private String sessionId;  // userEmail_filename (common identifier)

    @Column
    private Long bytesTransferred;  // cumulative file size for download/stream

    @Column(name = "file_path", length = 1000)
    private String filePath;  // complete file path — part of the unique key

    @Column
    private Long fileSize;  // file size in bytes

    @Column(length = 1024)
    private String userAgent;  // client user agent (raw)

    @Column(length = 64)
    private String remoteAddr;  // client IP address

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdTime;

    @Column(nullable = false)
    private Instant lastUpdated;  // updated on each activity

    @Column
    private Integer updateCount;

    /** CDN download-session ID returned by the resolve endpoint — links this DB record to nginx CDN logs. */
    @Column(length = 255)
    private String downloadId;

    /** CDN URL that was generated for this activity (stored for audit trail). */
    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String cdnUrl;

    /* ============================================================
       PRODUCTION TRACKING — added 2026-05-21
       ============================================================ */

    /** Direct FK to the catalog record this file belongs to. Resolved at insert via media_files.file_path. */
    @Column(name = "record_id")
    private Long recordId;

    /** Direct FK to the media_files row. UUID, varchar(36). */
    @Column(name = "media_file_id", length = 36)
    private String mediaFileId;

    /** Total completed DOWNLOAD sessions for this (user, file). Increments only on COMPLETED transitions. */
    @Column(name = "download_count", nullable = false, columnDefinition = "INT NOT NULL DEFAULT 0")
    private Integer downloadCount = 0;

    /** Total completed STREAM sessions for this (user, file). */
    @Column(name = "stream_count", nullable = false, columnDefinition = "INT NOT NULL DEFAULT 0")
    private Integer streamCount = 0;

    /** Peak parallel connections observed during the current/last session — signal of aria2/IDM/multi-threaded downloads. */
    @Column(name = "connection_count", nullable = false, columnDefinition = "INT NOT NULL DEFAULT 1")
    private Integer connectionCount = 1;

    /** Last known transfer status. */
    @Enumerated(EnumType.STRING)
    @Column(name = "completion_status", length = 16)
    private CompletionStatus completionStatus = CompletionStatus.STARTED;

    /** Last computed percent transferred (0–100). */
    @Column(name = "completion_percent", precision = 5, scale = 2)
    private BigDecimal completionPercent;

    /** When the file last finished transferring fully (null until first completion). */
    @Column(name = "last_completed_at")
    private Instant lastCompletedAt;

    /** When the user first interacted with this file (set on insert, never updated). */
    @Column(name = "first_seen_at", updatable = false)
    private Instant firstSeenAt;

    /** Parsed from User-Agent. {@link ClientType}. */
    @Enumerated(EnumType.STRING)
    @Column(name = "client_type", length = 16)
    private ClientType clientType = ClientType.UNKNOWN;

    /** HTTP protocol used: HTTP/1.1, HTTP/2, HTTP/3. */
    @Column(name = "http_protocol", length = 8)
    private String httpProtocol;

    /** HTTP Referer header. */
    @Column(name = "referer", length = 512)
    private String referer;

    /** ISO-3166-1 alpha-2 country code (optional — populated when geo lookup is available). */
    @Column(name = "country_code", length = 2)
    private String countryCode;

    /** Last error code if completionStatus == ABORTED. */
    @Column(name = "error_code", length = 64)
    private String errorCode;

    /** Average transfer speed for the current/last session, bytes/sec. */
    @Column(name = "avg_speed_bps")
    private Long avgSpeedBps;

    @PrePersist
    @PreUpdate
    private void updateTimestamps() {
        this.lastUpdated = Instant.now();
        if (this.createdTime == null) {
            this.createdTime = Instant.now();
        }
        if (this.firstSeenAt == null) {
            this.firstSeenAt = this.createdTime;
        }
    }

    // Helper methods
    public void updateActivity(String value, Long bytesTransferred) {
        this.activityValue = value;
        this.bytesTransferred = bytesTransferred;
        this.lastUpdated = Instant.now();
    }
}
