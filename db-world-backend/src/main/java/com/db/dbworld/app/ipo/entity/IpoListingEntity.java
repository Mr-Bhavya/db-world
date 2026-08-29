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
        uniqueConstraints = @UniqueConstraint(name = "uk_ipo_listing_match_key", columnNames = "match_key"),
        indexes = @Index(name = "idx_ipo_listing_status", columnList = "status"))
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

    /** Nullable — a real source may fill this later; until then the detail read derives it from {@code allotmentDate}. */
    private LocalDate refundDate;

    /** Nullable — a real source may fill this later; until then the detail read derives it from {@code allotmentDate}. */
    private LocalDate dematDate;

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

    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    /**
     * Bare domain (e.g. {@code "swiggy.com"}) used for a Logo.dev logo lookup on the frontend.
     * Nullable — seeder/enrichment-only, like the "About" facts below; never part of {@link
     * com.db.dbworld.app.ipo.dto.IpoDto}, so a live source poll can never touch it.
     */
    @Column(name = "logo_domain", length = 255)
    private String logoDomain;

    @Column(columnDefinition = "TEXT")
    private String about;

    /** ₹/share. Nullable — a real source may not report it. */
    @Column(name = "face_value", precision = 10, scale = 2)
    private BigDecimal faceValue;

    /** ₹ crore. Nullable — a real source may not report it. */
    @Column(name = "fresh_issue", precision = 12, scale = 2)
    private BigDecimal freshIssue;

    /** ₹ crore. Nullable — a real source may not report it. */
    @Column(name = "offer_for_sale", precision = 12, scale = 2)
    private BigDecimal offerForSale;

    /** NSE/BSE symbol, set once the IPO actually lists. Nullable until then. */
    @Column(name = "ticker_symbol", length = 20)
    private String tickerSymbol;

    /** Newline-delimited bullets; split into a {@code List<String>} on the detail DTO. */
    @Column(columnDefinition = "TEXT")
    private String strengths;

    /** Newline-delimited bullets; split into a {@code List<String>} on the detail DTO. */
    @Column(columnDefinition = "TEXT")
    private String risks;

    /** JSON array of {@code {label,value}} KPI rows (scrape-sourced); parsed to a list on the detail DTO. */
    @Column(name = "kpis_json", columnDefinition = "TEXT")
    private String kpisJson;

    /** JSON array of {@code {purpose,amount}} "Objects of the Issue" rows; parsed to a list on the detail DTO. */
    @Column(name = "issue_objects_json", columnDefinition = "TEXT")
    private String issueObjectsJson;

    /** Newline-delimited book-running lead manager(s); split into a {@code List<String>} on the detail DTO. */
    @Column(name = "lead_managers", columnDefinition = "TEXT")
    private String leadManagers;

    /** JSON object of the NSE "Issue details" (type/min-qty/sponsor-bank/RHP+DRHP links); parsed to a DTO on the detail. */
    @Column(name = "issue_details_json", columnDefinition = "TEXT")
    private String issueDetailsJson;

    // ── Company "About" profile facts ────────────────────────────────────────────────────────
    // Seeder-populated for now (a live adapter can fill these via a separate path later). Not
    // part of IpoDto/ingest — deliberately excluded from applyUpdatable/toNewEntity so ingest
    // polling can never touch them.

    @Column(name = "founded_year")
    private Integer foundedYear;

    /** The company's MD / CEO name. */
    @Column(name = "managing_director", length = 150)
    private String managingDirector;

    /** Nullable — not every company has a distinct listed parent. */
    @Column(name = "parent_company", length = 200)
    private String parentCompany;

    /** e.g. "Fintech", "E-commerce". */
    @Column(length = 100)
    private String sector;

    /** City. */
    @Column(length = 150)
    private String headquarters;

    @Column(length = 300)
    private String website;

    // ── Investorgain live tier ──────────────────────────────────────────────────────────────
    // Written only by InvestorgainLiveService (report 331 + the GMP dashboard), never by
    // ingest — investorgain wins the volatile numbers, NSE stays the exchange of record for
    // dates/status/pricing. Every value here is STORED AS REPORTED: investorgain already
    // publishes the percentages, the estimated listing price and the profit figure, so nothing
    // in this block is computed by us.

    /**
     * Investorgain's own IPO id, learned once by name and then reused forever. This is what makes
     * the live tier reliable: their report abbreviates company names ("Skyways Air" for "Skyways
     * Air Services Limited"), so re-matching on the name every poll silently lost IPOs. Null until
     * the first successful match.
     */
    @Column(name = "investorgain_id")
    private Integer investorgainId;

    /** Investorgain's 1–5 "fire" GMP rating. */
    @Column(name = "gmp_rating")
    private Integer gmpRating;

    /** Lowest GMP seen this cycle (their "N ↓" figure). */
    @Column(name = "gmp_min", precision = 10, scale = 2)
    private BigDecimal gmpMin;

    /** Highest GMP seen this cycle (their "N ↑" figure). */
    @Column(name = "gmp_max", precision = 10, scale = 2)
    private BigDecimal gmpMax;

    /**
     * Investorgain's own "last updated" label for the GMP, verbatim (e.g. {@code "27-Aug 19:59"}).
     * Kept as text on purpose — the report's label carries no year, and inventing one to parse it
     * would be exactly the kind of derived value this block avoids.
     */
    @Column(name = "gmp_updated_label", length = 60)
    private String gmpUpdatedLabel;

    /** Their estimated listing price (cap + current GMP) — their arithmetic, not ours. */
    @Column(name = "estimated_listing_price", precision = 10, scale = 2)
    private BigDecimal estimatedListingPrice;

    /** Retail "subject to sauda" rate in ₹, as reported. Grey-market figure, attributed in the UI. */
    @Column(name = "subject_to_sauda", precision = 12, scale = 2)
    private BigDecimal subjectToSauda;

    /** Their estimated per-lot profit in ₹, as reported. Grey-market figure, attributed in the UI. */
    @Column(name = "est_profit", precision = 12, scale = 2)
    private BigDecimal estProfit;

    /** Price/earnings ratio as reported (their {@code ~P/E}). */
    @Column(name = "pe_ratio", precision = 10, scale = 2)
    private BigDecimal peRatio;

    /** Whether the issue has anchor-investor participation. */
    @Column(name = "anchor_investor")
    private Boolean anchorInvestor;

    /** Registrar's allotment-status page for this IPO, straight from the GMP dashboard. */
    @Column(name = "allotment_link", length = 500)
    private String allotmentLink;

    /** Investorgain's "as of" label for the subscription figures, verbatim (e.g. {@code "27th Aug 2026 17:11"}). */
    @Column(name = "subscription_updated_label", length = 60)
    private String subscriptionUpdatedLabel;

    @Column(name = "first_seen_at", nullable = false)
    private Instant firstSeenAt;

    @Column(name = "last_seen_at", nullable = false)
    private Instant lastSeenAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /**
     * When the "closing soon" push was sent for this IPO — a once-per-IPO dedupe marker so the
     * reminder (fired from the poll each cycle) isn't re-sent on every subsequent poll. Null until
     * the reminder goes out.
     */
    @Column(name = "closing_soon_notified_at")
    private Instant closingSoonNotifiedAt;
}
