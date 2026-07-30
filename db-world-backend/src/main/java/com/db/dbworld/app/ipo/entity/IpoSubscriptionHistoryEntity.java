package com.db.dbworld.app.ipo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

/** One subscription (times-oversubscribed) reading for an IPO, captured from a source at a point in time. */
@Entity
@Table(schema = "db_world", name = "ipo_subscription_history",
        indexes = @Index(name = "idx_ipo_sub_history_ipo_captured", columnList = "ipo_id, captured_at"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpoSubscriptionHistoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 36)
    private String id;

    @Column(name = "ipo_id", nullable = false, length = 36)
    private String ipoId;

    /**
     * Category → multiple JSON object, e.g. {@code {"QIB":2.10,"NII":5.30,"Retail":8.00}}. Any
     * category a source reports (QIB/NII/Retail/Employee/Shareholder/Anchor/...) lives here —
     * see {@link com.db.dbworld.app.ipo.service.IpoSubscriptionJson} for the (de)serialization.
     */
    @Column(name = "categories_json", columnDefinition = "TEXT")
    private String categoriesJson;

    /**
     * Full per-category breakdown JSON — a {@code [{category,times,sharesOffered,sharesBid,
     * bidAmountCr}]} array (see {@link com.db.dbworld.app.ipo.dto.SubscriptionCategoryDto}) so the
     * detail page can show shares offered/bid, bid amount, lots and % of total exactly like
     * investorgain. Nullable — {@code categories_json} (category→multiple) remains the lightweight
     * series used by the day-wise multiples table/chart.
     */
    @Column(name = "category_detail_json", columnDefinition = "TEXT")
    private String categoryDetailJson;

    @Column(precision = 10, scale = 2) private BigDecimal total;

    @Column(length = 30)
    private String source;

    @Column(name = "captured_at", nullable = false)
    private Instant capturedAt;
}
