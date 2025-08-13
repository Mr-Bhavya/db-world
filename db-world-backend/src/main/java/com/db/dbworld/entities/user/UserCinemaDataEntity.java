package com.db.dbworld.entities.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.Date;

@Getter
@Setter
@Entity
@EntityListeners(AuditingEntityListener.class)
@Table(name = "USER_CINEMA_DATA", indexes = {
        @Index(name = "idx_download_id", columnList = "downloadId"),
        @Index(name = "idx_download_status", columnList = "status"),
})
@SequenceGenerator(name = "USER_CINEMA_DATA_SEQ", allocationSize = 1)
public class UserCinemaDataEntity {

    public enum Status {
        IN_PROGRESS,
        PAUSED,
        COMPLETED,
        FAILED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "USER_CINEMA_DATA_SEQ")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user", nullable = false)
    private UserEntity user;

    private String event;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String value;

    @CreatedDate
    @Column(nullable = false)
    private Date time;

    @Column(nullable = false)
    private String downloadId;  // Unique identifier for each download session

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.IN_PROGRESS;

    @Column
    private Long fileSize;  // Total size of the file in bytes

    @Column
    private Long bytesTransferred;  // Total bytes transferred

    @Column
    private Instant lastActivity;  // Last time this download was active

    // Additional fields for tracking
    @Column
    private String filePath;  // Original file path

    @Column
    private String remoteAddr;  // Client IP address

    @Column
    private String userAgent;  // Client user agent

    @PrePersist
    @PreUpdate
    private void updateTimestamps() {
        if (this.lastActivity == null) {
            this.lastActivity = Instant.now();
        }
    }

    // Helper method to mark as completed
    public void markCompleted() {
        this.status = Status.COMPLETED;
        this.lastActivity = Instant.now();
    }

    // Helper method to mark as paused
    public void markPaused() {
        this.status = Status.PAUSED;
        this.lastActivity = Instant.now();
    }

    // Helper method to resume download
    public void resume() {
        this.status = Status.IN_PROGRESS;
        this.lastActivity = Instant.now();
    }
}