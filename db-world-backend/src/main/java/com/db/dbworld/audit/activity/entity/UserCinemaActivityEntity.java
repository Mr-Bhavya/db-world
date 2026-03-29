package com.db.dbworld.audit.activity.entity;

import com.db.dbworld.core.user.entity.UserEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

@Getter
@Setter
@Entity
@EntityListeners(AuditingEntityListener.class)
@Table(name = "USER_CINEMA_ACTIVITY", indexes = {
        @Index(name = "idx_session_id", columnList = "sessionId"),
        @Index(name = "idx_activity_type", columnList = "activityType"),
        @Index(name = "idx_user_activity", columnList = "user_id, lastUpdated")
})
//@SequenceGenerator(name = "USER_CINEMA_ACTIVITY_SEQ", allocationSize = 1)
public class UserCinemaActivityEntity {

    public enum ActivityType {
        DOWNLOAD,
        STREAM,
        SEARCH
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, name = "activity_type")
    private ActivityType activityType;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String activityValue;  // download/stream file path, search keyword

    @Column(nullable = false)
    private String sessionId;  // userEmail_filename (common identifier)

    @Column
    private Long bytesTransferred;  // file size for download/stream

    @Column
    private String filePath;  // complete file path

    @Column
    private Long fileSize;  // file size in bytes

    @Column
    private String userAgent;  // client user agent

    @Column
    private String remoteAddr;  // client IP address

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdTime;

    @Column(nullable = false)
    private Instant lastUpdated;  // updated on each activity

    @Column
    private Integer updateCount;

    @PrePersist
    @PreUpdate
    private void updateTimestamps() {
        this.lastUpdated = Instant.now();
        if (this.createdTime == null) {
            this.createdTime = Instant.now();
        }
    }

    // Helper methods
    public void updateActivity(String value, Long bytesTransferred) {
        this.activityValue = value;
        this.bytesTransferred = bytesTransferred;
        this.lastUpdated = Instant.now();
    }
}
