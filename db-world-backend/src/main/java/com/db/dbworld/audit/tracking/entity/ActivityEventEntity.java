package com.db.dbworld.audit.tracking.entity;

import com.db.dbworld.audit.tracking.enums.*;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@Entity
@Table(name = "ACTIVITY_EVENT", schema = "db_world",
    indexes = {
        @Index(name = "idx_ae_user_time", columnList = "user_id, event_time"),
        @Index(name = "idx_ae_session",   columnList = "session_id"),
        @Index(name = "idx_ae_media",     columnList = "media_file_id"),
        @Index(name = "idx_ae_kind_time", columnList = "activity, event_time")
    },
    uniqueConstraints = @UniqueConstraint(
        name = "uk_ae_session_clientevent", columnNames = {"session_id", "client_event_id"}))
public class ActivityEventEntity {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_time", nullable = false) private Instant eventTime;
    @Column(name = "received_at", nullable = false) private Instant receivedAt;

    @Column(name = "user_id") private Long userId;
    @Column(name = "session_id", nullable = false, length = 64) private String sessionId;
    @Column(name = "client_event_id", length = 64) private String clientEventId;

    @Enumerated(EnumType.STRING) @Column(name = "activity", nullable = false, length = 16)
    private ActivityKind activity;
    @Enumerated(EnumType.STRING) @Column(name = "event_type", nullable = false, length = 20)
    private TrackEventType eventType;
    @Enumerated(EnumType.STRING) @Column(name = "channel", length = 12)
    private TrackChannel channel;
    @Column(name = "client_app", length = 40) private String clientApp;
    @Enumerated(EnumType.STRING) @Column(name = "source", nullable = false, length = 10)
    private TrackSource source;

    @Column(name = "media_file_id", length = 36) private String mediaFileId;
    @Column(name = "record_id") private Long recordId;
    @Column(name = "season_number") private Integer seasonNumber;
    @Column(name = "episode_number") private Integer episodeNumber;
    @Column(name = "file_path", length = 1024) private String filePath;
    @Column(name = "file_size") private Long fileSize;

    @Column(name = "bytes_delta") private Long bytesDelta;
    @Column(name = "cumulative_bytes") private Long cumulativeBytes;
    @Column(name = "range_start") private Long rangeStart;
    @Column(name = "range_end") private Long rangeEnd;
    @Column(name = "speed_bps") private Long speedBps;
    @Column(name = "connections") private Integer connections;
    @Column(name = "position_ms") private Long positionMs;
    @Column(name = "duration_ms") private Long durationMs;
    @Column(name = "completion_percent", precision = 5, scale = 2) private BigDecimal completionPercent;
    @Column(name = "http_status") private Integer httpStatus;
    @Column(name = "error_code", length = 40) private String errorCode;
    @Column(name = "error_message", length = 512) private String errorMessage;

    @Column(name = "search_query", length = 256) private String searchQuery;
    @Column(name = "result_count") private Integer resultCount;

    @Column(name = "remote_addr", length = 64) private String remoteAddr;
    @Column(name = "user_agent", length = 512) private String userAgent;
}
