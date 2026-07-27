package com.db.dbworld.app.ipo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

/** One grey-market-premium reading for an IPO, captured from a source at a point in time. */
@Entity
@Table(schema = "db_world", name = "ipo_gmp_history",
        indexes = @Index(name = "idx_ipo_gmp_history_ipo_captured", columnList = "ipo_id, captured_at"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpoGmpHistoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 36)
    private String id;

    @Column(name = "ipo_id", nullable = false, length = 36)
    private String ipoId;

    @Column(precision = 10, scale = 2)
    private BigDecimal gmp;

    @Column(precision = 8, scale = 2)
    private BigDecimal gmpPct;

    @Column(length = 30)
    private String source;

    @Column(name = "captured_at", nullable = false)
    private Instant capturedAt;
}
