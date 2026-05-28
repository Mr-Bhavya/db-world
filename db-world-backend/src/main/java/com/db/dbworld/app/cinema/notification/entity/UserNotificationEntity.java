package com.db.dbworld.app.cinema.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.Instant;

@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "USER_NOTIFICATIONS", schema = "new_db_world")
public class UserNotificationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "recipient_user_id", nullable = false)
    private Long recipientUserId;

    @Column(name = "actor_user_id", nullable = false)
    private Long actorUserId;

    @Column(name = "actor_username", nullable = false, length = 150)
    private String actorUsername;

    @Column(name = "record_id", nullable = false)
    private Long recordId;

    @Column(name = "record_title", nullable = false, length = 300)
    private String recordTitle;

    @Column(name = "record_type", nullable = false, length = 30)
    private String recordType;

    /**
     * Notification kind. Nullable for backward-compat with rows created before this column existed
     * — treat null as {@code REVIEW} on read.
     */
    @Column(name = "notification_type", length = 30)
    private String type;

    /**
     * Optional free-text message attached to the notification. Used for things like an
     * admin's dismiss reason ("Not available in higher quality") so the recipient sees
     * context, not just a generic "request dismissed" line.
     */
    @Column(name = "message", length = 500)
    private String message;

    @Builder.Default
    @Column(name = "is_read", nullable = false)
    private boolean read = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
