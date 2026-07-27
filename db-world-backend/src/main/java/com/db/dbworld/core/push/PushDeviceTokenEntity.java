package com.db.dbworld.core.push;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * One registered device push token (FCM registration token) belonging to a user. The token is
 * unique — the same physical device re-registering just refreshes {@code userId}/{@code platform}/
 * {@code lastSeenAt} rather than creating a duplicate. Tokens are subscribed to the broadcast topic
 * on register; the store lets us re-subscribe and prune stale tokens later.
 */
@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "push_device_token", schema = "db_world",
    uniqueConstraints = @UniqueConstraint(name = "uk_push_device_token", columnNames = "token"),
    indexes = @Index(name = "idx_push_device_user", columnList = "user_id"))
public class PushDeviceTokenEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** FCM registration token — can be fairly long, so allow generous room. */
    @Column(name = "token", nullable = false, length = 512)
    private String token;

    /** "web" | "android" | "ios" — free-text, informational (cleanup / analytics). */
    @Column(name = "platform", length = 20)
    private String platform;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "last_seen_at", nullable = false)
    private Instant lastSeenAt;
}
