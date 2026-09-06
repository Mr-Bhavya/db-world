package com.db.dbworld.app.ipo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Audit trail of notable field changes detected during ingestion (e.g. GMP jump, status change). */
@Entity
@Table(schema = "db_world", name = "ipo_change_event",
        indexes = @Index(name = "idx_ipo_change_event_ipo", columnList = "ipo_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpoChangeEventEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 36)
    private String id;

    @Column(name = "ipo_id", nullable = false, length = 36)
    private String ipoId;

    @Column(name = "event_type", nullable = false, length = 40)
    private String eventType;

    @Column(name = "old_value", length = 200)
    private String oldValue;

    @Column(name = "new_value", length = 200)
    private String newValue;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /**
     * When this event's user-facing push was handled — set once it has been broadcast, OR
     * deliberately skipped (not a notifiable transition, below the GMP threshold, or too old to be
     * worth announcing). Null means "still pending delivery", which is what
     * {@code IpoNotificationService.dispatchPending()} drains: an event detected outside the IST
     * notification window stays pending and goes out at the next in-window pass instead of being
     * lost, and no event can ever be pushed twice.
     */
    @Column(name = "notified_at")
    private Instant notifiedAt;
}
