package com.db.dbworld.app.ipo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Poll health/status for one IPO data source, keyed by the source's own key (not a generated id). */
@Entity
@Table(schema = "db_world", name = "ipo_source_poll")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpoSourcePollEntity {

    @Id
    @Column(length = 30)
    private String source;

    @Column(name = "last_polled_at")
    private Instant lastPolledAt;

    @Column(name = "last_success_at")
    private Instant lastSuccessAt;

    @Column(name = "last_status", length = 30)
    private String lastStatus;

    @Column(name = "consecutive_failures", nullable = false)
    @Builder.Default
    private int consecutiveFailures = 0;
}
