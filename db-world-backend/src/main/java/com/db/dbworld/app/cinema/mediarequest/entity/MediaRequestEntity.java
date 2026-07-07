package com.db.dbworld.app.cinema.mediarequest.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "media_requests",
        schema = "new_db_world",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_media_request_record_kind",
                columnNames = {"record_id", "kind"}
        ),
        // Admin queue: countByStatus + findAllByStatus ORDER BY created_at.
        indexes = @Index(name = "idx_media_req_status_created", columnList = "status, created_at")
)
public class MediaRequestEntity implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "record_id", nullable = false)
    private Long recordId;

    @Column(name = "record_title", nullable = false, length = 300)
    private String recordTitle;

    @Column(name = "record_type", nullable = false, length = 30)
    private String recordType;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 30)
    @Builder.Default
    private MediaRequestKind kind = MediaRequestKind.NEW_FILES;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private MediaRequestStatus status = MediaRequestStatus.PENDING;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "fulfilled_at")
    private Instant fulfilledAt;

    @Column(name = "fulfilled_by_user_id")
    private Long fulfilledByUserId;

    @Column(name = "fulfilled_by_username", length = 150)
    private String fulfilledByUsername;

    /** Optional reason captured when an admin dismisses the request; mirrored into voter notifications. */
    @Column(name = "dismiss_reason", length = 500)
    private String dismissReason;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(
            name = "media_request_voters",
            schema = "new_db_world",
            joinColumns = @JoinColumn(name = "request_id"),
            uniqueConstraints = @UniqueConstraint(
                    name = "uk_media_request_voter",
                    columnNames = {"request_id", "user_id"}
            )
    )
    @Column(name = "user_id", nullable = false)
    @Builder.Default
    private Set<Long> voterUserIds = new HashSet<>();
}
