package com.db.dbworld.app.ipo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Audit trail of notable field changes detected during ingestion (e.g. GMP jump, status change). */
@Entity
@Table(schema = "db_world", name = "ipo_change_event",
        indexes = {
                @Index(name = "idx_ipo_change_event_ipo", columnList = "ipo_id"),
                @Index(name = "idx_ipo_change_event_pushed", columnList = "pushed_at")
        })
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

    /**
     * When a push for this event actually went out — null if it was handled but suppressed.
     *
     * <p>Distinct from {@code notifiedAt}, which only means "the queue is done with this row" and
     * is stamped just as eagerly on a suppressed event as on a delivered one. That conflation is
     * why volume control needs its own column: the per-IPO cooldown, the daily cap and the
     * "compare against the last GMP we actually announced" test all have to count SENDS, and
     * counting {@code notifiedAt} would count every silent drop as if it had buzzed a phone.
     */
    @Column(name = "pushed_at")
    private Instant pushedAt;
}
