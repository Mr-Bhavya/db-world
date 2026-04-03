package com.db.dbworld.app.cinema.review.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(
    name = "user_reviews",
    schema = "db_world",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_user_record_review",
        columnNames = {"user_id", "record_id"}
    )
)
@Getter
@Setter
@NoArgsConstructor
public class UserReviewEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 36)
    private String id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "record_id", nullable = false)
    private Long recordId;

    /** Display name — denormalised from JWT at write time so reads need no join. */
    @Column(nullable = false, length = 120)
    private String username;

    /** 1–10 (half-star-friendly if frontend wants 0.5 steps). */
    @Column(nullable = false)
    private int rating;

    @Column(columnDefinition = "TEXT")
    private String content;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;
}
