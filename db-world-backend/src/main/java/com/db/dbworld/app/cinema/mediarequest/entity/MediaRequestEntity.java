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
        schema = "db_world",
        // Scope is part of the identity of a request: "needs files for season 2" and "needs
        // files for S02E05" are different asks on the same record and must be able to coexist.
        // Replaces the old uk_media_request_record_kind, which the migration drops — leaving it
        // in place would reject the second scope on a record with "Duplicate entry".
        uniqueConstraints = @UniqueConstraint(
                name = "uk_media_request_scope",
                columnNames = {"record_id", "kind", "season_number", "episode_number"}
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

    /**
     * Season this request is scoped to, or {@link MediaRequestScope#ALL} for the whole title.
     * <p>The explicit {@code columnDefinition} is load-bearing: it carries the DEFAULT into the
     * {@code ALTER TABLE} that {@code ddl-auto: update} generates, so rows that predate the
     * column are backfilled with -1 rather than MySQL's implicit 0 — and 0 is Specials.
     */
    @Column(name = "season_number", nullable = false, columnDefinition = "int NOT NULL DEFAULT -1")
    @Builder.Default
    private int seasonNumber = MediaRequestScope.ALL;

    /** Episode within {@link #seasonNumber}, or {@link MediaRequestScope#ALL} for the whole season. */
    @Column(name = "episode_number", nullable = false, columnDefinition = "int NOT NULL DEFAULT -1")
    @Builder.Default
    private int episodeNumber = MediaRequestScope.ALL;

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
            schema = "db_world",
            joinColumns = @JoinColumn(name = "request_id"),
            uniqueConstraints = @UniqueConstraint(
                    name = "uk_media_request_voter",
                    columnNames = {"request_id", "user_id"}
            )
    )
    @Column(name = "user_id", nullable = false)
    @Builder.Default
    private Set<Long> voterUserIds = new HashSet<>();

    /** The season/episode this request is scoped to. */
    @Transient
    public MediaRequestScope scope() {
        return MediaRequestScope.ofRaw(seasonNumber, episodeNumber);
    }
}
