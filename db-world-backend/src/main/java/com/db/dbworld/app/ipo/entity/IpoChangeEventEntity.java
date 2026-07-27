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
}
