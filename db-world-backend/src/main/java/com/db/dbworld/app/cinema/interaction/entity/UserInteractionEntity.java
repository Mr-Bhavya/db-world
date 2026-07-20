package com.db.dbworld.app.cinema.interaction.entity;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.interaction.enums.InteractionType;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "USER_INTERACTIONS",
        schema = "db_world",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_user_record_interaction",
                        columnNames = {"user_id", "record_id", "interaction_type"}
                )
        },
        // The unique key has record_id between user_id and interaction_type, so it can't serve
        // the frequent (user_id, interaction_type) lookups — index that pair directly.
        indexes = {
                @Index(name = "idx_interactions_user_type", columnList = "user_id, interaction_type")
        }
)
public class UserInteractionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "record_id", nullable = false)
    private RecordEntity record;

    @Enumerated(EnumType.STRING)
    @Column(name = "interaction_type", nullable = false)
    private InteractionType interactionType;

    /**
     * Used for watch progress (seconds)
     */
    private Integer progress;

    /**
     * Timestamp of interaction
     */
    private Instant createdAt;

}