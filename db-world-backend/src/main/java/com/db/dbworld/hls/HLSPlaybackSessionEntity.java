package com.db.dbworld.hls;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "hls_playback_sessions")
@Data
public class HLSPlaybackSessionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", unique = true, nullable = false)
    private String sessionId;

    @Column(name = "user_id")
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hls_content_id")
    private HLSContentEntity hlsContent;

    @Column(name = "record_id")
    private Long recordId;

    @Column(name = "media_file_id")
    private Long mediaFileId;

    @Column(name = "device_info", length = 500)
    private String deviceInfo;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "selected_resolution", length = 50)
    private String selectedResolution;

    @Column(name = "`current_time`")
    private Double currentTime;

    @Column(name = "duration")
    private Double duration;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20)
    private HLSPlaybackStatus status;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Column(name = "last_heartbeat")
    private LocalDateTime lastHeartbeat;

    @Column(name = "quality_switches")
    private Integer qualitySwitches;

    @Column(name = "buffering_count")
    private Integer bufferingCount;

    @Column(name = "total_buffering_time")
    private Double totalBufferingTime;

    @Column(name = "average_bitrate")
    private Long averageBitrate;

    @Column(name = "bytes_downloaded")
    private Long bytesDownloaded;

    @Column(name = "error_count")
    private Integer errorCount;

    @Column(name = "last_error", length = 500)
    private String lastError;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}