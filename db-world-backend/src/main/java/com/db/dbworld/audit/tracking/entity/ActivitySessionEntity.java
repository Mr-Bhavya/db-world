package com.db.dbworld.audit.tracking.entity;

import com.db.dbworld.audit.tracking.enums.*;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@Entity
@Table(name = "ACTIVITY_SESSION", schema = "new_db_world",
    indexes = {
        @Index(name = "idx_as_user_last",  columnList = "user_id, last_event_at"),
        @Index(name = "idx_as_state_last", columnList = "state, last_event_at"),
        @Index(name = "idx_as_media",      columnList = "media_file_id"),
        @Index(name = "idx_as_record",     columnList = "record_id"),
        @Index(name = "idx_as_kind_state", columnList = "activity, state")
    })
public class ActivitySessionEntity {

    @Id @Column(name = "session_id", length = 64) private String sessionId;

    @Column(name = "user_id") private Long userId;
    @Enumerated(EnumType.STRING) @Column(name = "activity", nullable = false, length = 16)
    private ActivityKind activity;
    @Enumerated(EnumType.STRING) @Column(name = "channel", length = 12) private TrackChannel channel;
    @Column(name = "client_app", length = 40) private String clientApp;

    @Column(name = "media_file_id", length = 36) private String mediaFileId;
    @Column(name = "record_id") private Long recordId;
    @Column(name = "season_number") private Integer seasonNumber;
    @Column(name = "episode_number") private Integer episodeNumber;
    @Column(name = "file_path", length = 1024) private String filePath;
    @Column(name = "file_name", length = 512) private String fileName;
    @Column(name = "file_size") private Long fileSize;

    @Enumerated(EnumType.STRING) @Column(name = "state", nullable = false, length = 12)
    private SessionState state;

    @Column(name = "unique_bytes") private Long uniqueBytes;
    @Column(name = "client_bytes") private Long clientBytes;
    @Column(name = "nginx_transferred_bytes") private Long nginxTransferredBytes;
    @Column(name = "completion_percent", precision = 5, scale = 2) private BigDecimal completionPercent;
    @Column(name = "peak_connections") private Integer peakConnections;
    // avg_speed_bps: populated in Plan 1B (needs live elapsed-time data). Consumers derive wasted bytes = nginxTransferredBytes - uniqueBytes.
    @Column(name = "avg_speed_bps") private Long avgSpeedBps;
    @Column(name = "max_speed_bps") private Long maxSpeedBps;

    @Column(name = "attempt_count") private Integer attemptCount;
    @Column(name = "pause_count") private Integer pauseCount;
    @Column(name = "resume_count") private Integer resumeCount;
    @Column(name = "fail_count") private Integer failCount;

    @Column(name = "has_client_events") private Boolean hasClientEvents;
    @Column(name = "last_error_code", length = 40) private String lastErrorCode;
    @Column(name = "last_error_message", length = 512) private String lastErrorMessage;

    @Column(name = "started_at") private Instant startedAt;
    @Column(name = "last_event_at") private Instant lastEventAt;
    @Column(name = "completed_at") private Instant completedAt;

    @Column(name = "watch_position_ms") private Long watchPositionMs;
    @Column(name = "watch_duration_ms") private Long watchDurationMs;
    @Column(name = "watch_progress_id") private Long watchProgressId;

    @Column(name = "remote_addr", length = 64) private String remoteAddr;
    @Column(name = "user_agent", length = 512) private String userAgent;

    /** Coalesced delivered inclusive byte intervals, serialized as "s:e,s:e". */
    @Column(name = "range_intervals", length = 4096) private String rangeIntervals;
}
