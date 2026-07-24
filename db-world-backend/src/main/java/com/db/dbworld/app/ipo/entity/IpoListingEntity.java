package com.db.dbworld.app.ipo.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * One IPO, normalised/merged across sources. {@code matchKey} is the dedup key
 * ingestion uses to decide whether an incoming source row is a new IPO or an
 * update to an existing one.
 */
@Entity
@Table(schema = "db_world", name = "ipo_listing",
        uniqueConstraints = @UniqueConstraint(name = "uk_ipo_listing_match_key", columnNames = "match_key"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpoListingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 36)
    private String id;

    @Column(name = "match_key", nullable = false, length = 200)
    private String matchKey;

    @Column(name = "company_name", length = 300)
    private String companyName;

    @Column(name = "ipo_type", length = 20)
    private String ipoType;

    @Column(length = 30)
    private String status;

    private LocalDate openDate;
    private LocalDate closeDate;
    private LocalDate allotmentDate;
    private LocalDate listingDate;

    @Column(precision = 10, scale = 2) private BigDecimal priceMin;
    @Column(precision = 10, scale = 2) private BigDecimal priceMax;
    @Column(precision = 10, scale = 2) private BigDecimal listingPrice;
    @Column(precision = 8, scale = 2)  private BigDecimal listingGainPct;
    @Column(precision = 10, scale = 2) private BigDecimal gmp;
    @Column(precision = 8, scale = 2)  private BigDecimal gmpPct;
    @Column(precision = 10, scale = 2) private BigDecimal subTotal;

    private Integer lotSize;

    @Column(name = "issue_size", length = 100)
    private String issueSize;

    @Column(name = "listing_exchange", length = 20)
    private String listingExchange;

    @Column(name = "allotment_status", length = 30)
    private String allotmentStatus;

    @Column(length = 150)
    private String registrar;

    @Column(name = "registrar_url", length = 500)
    private String registrarUrl;

    @Column(name = "first_seen_at", nullable = false)
    private Instant firstSeenAt;

    @Column(name = "last_seen_at", nullable = false)
    private Instant lastSeenAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
