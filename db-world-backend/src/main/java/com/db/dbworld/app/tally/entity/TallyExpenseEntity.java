package com.db.dbworld.app.tally.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * One thing somebody paid for, to be divided among the group.
 *
 * <p>The header only carries the total. Who put the money in lives in
 * {@link TallyExpensePayerEntity} — there can be more than one — and who consumed it lives in
 * {@link TallyExpenseShareEntity}. Those two together are the source of truth; the ledger is a
 * projection written from them inside the same transaction.
 *
 * <p><b>Never edited in place.</b> A correction is a reversal plus a re-post, so the append-only
 * ledger stays a faithful record of what the group believed and when. An UPDATE here would leave
 * ledger rows describing an allocation of a total that no longer exists.
 */
@Entity
@Table(name = "tally_expense", schema = "db_world",
        uniqueConstraints = {
            // Scoped to the group, NOT globally unique. A global key would let one user's retry
            // token collide with an unrelated group's insert, which both blocks a legitimate
            // write and leaks the existence of a group the caller cannot see. Nullable, so rows
            // written without a token coexist -- NULLs are distinct.
            @UniqueConstraint(name = "uk_tally_expense_group_idem",
                    columnNames = {"group_id", "idempotency_key"})
        },
        indexes = {
            // The group's expense feed, keyset-paginated by (expense_date, id) descending.
            // status sits SECOND so the ACTIVE filter is part of the seek rather than a filter
            // applied after it. That ordering is the reason status is an enum column and not a
            // nullable voided_at: a nullable datetime mid-composite cannot give an equality match.
            @Index(name = "idx_tally_expense_group_date",
                    columnList = "group_id, status, expense_date, id")
        })
@Getter @Setter @NoArgsConstructor
public class TallyExpenseEntity {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "group_id", nullable = false, length = 36) private String groupId;

    @Column(nullable = false, length = 200) private String description;

    /**
     * Always positive, always scale 2. DECIMAL rather than double: binary floating point cannot
     * represent ten paise, and money that cannot be represented cannot be reconciled.
     */
    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    /**
     * How the total was divided. Stored even though the resulting share rows stand on their own,
     * because re-opening an expense to edit it otherwise cannot tell an EQUAL split of 300 across
     * three people from an EXACT one that happens to be 100 each.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "division_method", nullable = false, length = 20)
    private TallyMethod divisionMethod = TallyMethod.EQUAL;

    @Column(length = 60) private String category;

    /** The day the money was spent, which is not the day the row was written. */
    @Column(name = "expense_date", nullable = false) private LocalDate expenseDate;

    @Column(name = "created_by_user_id", nullable = false) private Long createdByUserId;

    @Column(length = 1000) private String notes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TallyExpenseStatus status = TallyExpenseStatus.ACTIVE;

    /** Client-supplied retry token; see {@code uk_tally_expense_group_idem}. */
    @Column(name = "idempotency_key", length = 64) private String idempotencyKey;

    @CreationTimestamp @Column(nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(nullable = false)                    private Instant updatedAt;

    public boolean isActive() {
        return status == TallyExpenseStatus.ACTIVE;
    }
}
