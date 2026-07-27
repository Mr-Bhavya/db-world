package com.db.dbworld.app.ipo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/** One fiscal year's revenue/profit-after-tax/total-assets for an IPO, for the detail page's P&L section. */
@Entity
@Table(schema = "db_world", name = "ipo_financial",
        indexes = @Index(name = "idx_ipo_financial_ipo_id", columnList = "ipo_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpoFinancialEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 36)
    private String id;

    @Column(name = "ipo_id", nullable = false, length = 36)
    private String ipoId;

    @Column(name = "fiscal_year", length = 32)
    private String fiscalYear;

    @Column(precision = 14, scale = 2)
    private BigDecimal revenue;

    @Column(precision = 14, scale = 2)
    private BigDecimal pat;

    /** ₹ crore. Nullable — a real source may not report it. */
    @Column(name = "total_assets", precision = 14, scale = 2)
    private BigDecimal totalAssets;

    /**
     * The period's end date — used ONLY as the chronological sort key ({@code fiscalYear} stays
     * the human display label, which is not sortable as a string: e.g. "Feb 2026" sorts before
     * "FY 2021-22").
     */
    @Column(name = "period_end")
    private LocalDate periodEnd;
}
