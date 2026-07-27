package com.db.dbworld.app.ipo.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * One user's saved application details for one IPO — the applicant-level "My IPOs" feature:
 * application number, DP client id, the PAN's last 4 digits, and the allotment result the user
 * has recorded for themselves. Exactly one row per {@code (userId, ipoId)} pair.
 *
 * <p><b>PII rule:</b> {@code panLast4} is the only PAN-derived value ever persisted here — a full
 * PAN is never written to this entity or logged; {@code IpoApplicationService} reduces it to the
 * last 4 characters before this entity is touched.
 */
@Entity
@Table(schema = "db_world", name = "ipo_user_application",
        uniqueConstraints = @UniqueConstraint(name = "uk_ipo_user_application_user_ipo", columnNames = {"user_id", "ipo_id"}),
        indexes = {
            @Index(name = "idx_ipo_user_application_user", columnList = "user_id"),
            @Index(name = "idx_ipo_user_application_ipo", columnList = "ipo_id")
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IpoUserApplicationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(length = 36)
    private String id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "ipo_id", nullable = false, length = 36)
    private String ipoId;

    @Column(name = "applicant_name", length = 150)
    private String applicantName;

    @Column(name = "application_no", length = 100)
    private String applicationNo;

    @Column(name = "dp_client_id", length = 100)
    private String dpClientId;

    /** Last 4 characters of the PAN only — never the full value. */
    @Column(name = "pan_last4", length = 4)
    private String panLast4;

    /** {@code unknown|allotted|not_allotted} — the user's own self-recorded result. */
    @Column(name = "allotment_result", length = 20)
    private String allotmentResult;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
