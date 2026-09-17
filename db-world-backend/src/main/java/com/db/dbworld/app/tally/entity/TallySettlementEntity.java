package com.db.dbworld.app.tally.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A payment one member made to another to clear part of what they owed.
 *
 * <p><b>One-sided:</b> recording it is enough, the other side never confirms. That is a
 * deliberate simplification — a confirmation step turns every settled debt into a pending task
 * somebody has to chase — but it puts real weight on the two safeguards below.
 *
 * <p>Settling is an ordinary write. The {@code settle-up} endpoint only ever <em>suggests</em> a
 * set of transfers; recording one of them comes back through here like any other payment.
 */
@Entity
@Table(name = "tally_settlement", schema = "db_world",
        uniqueConstraints = {
            // Safeguard one. Because settlement is one-sided, a double-tap on a flaky connection
            // does not just duplicate a row -- it drives the balance 500 rupees the wrong way and
            // looks, to both people, like the payer overpaid.
            @UniqueConstraint(name = "uk_tally_settlement_group_idem",
                    columnNames = {"group_id", "idempotency_key"})
        },
        indexes = {
            @Index(name = "idx_tally_settlement_group_date",
                    columnList = "group_id, settled_at")
        })
@Getter @Setter @NoArgsConstructor
public class TallySettlementEntity {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "group_id", nullable = false, length = 36) private String groupId;

    /** Who paid. */
    @Column(name = "from_member_id", nullable = false, length = 36) private String fromMemberId;
    /** Who was paid. */
    @Column(name = "to_member_id", nullable = false, length = 36)   private String toMemberId;

    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal amount;

    /** Free text — "UPI", "cash", "bank transfer". Display only; nothing branches on it. */
    @Column(length = 40) private String method;

    /**
     * The LOAN this payment repays, when it repays one.
     *
     * <p>Null for an ordinary settle-up, which is deliberately unallocated: clearing a balance
     * built from a dozen shared dinners does not repay any particular dinner, and pretending it
     * does would invent an allocation nobody chose.
     *
     * <p>A loan is the opposite case. "I lent 1,000 and got 500 back" is two facts about ONE
     * loan, and without this column the pair is unrecoverable -- the ledger nets to 500 owed and
     * cannot say whether that is half of one loan or the whole of another. The balance was always
     * right; it was the progress that could not be told.
     *
     * <p>Not a foreign key, matching {@code source_id} on the ledger entries: the tables in this
     * module reference each other by id without constraints, and a settlement outliving the row
     * it points at is handled by reading it as unallocated rather than by refusing the delete.
     */
    @Column(name = "settles_expense_id", length = 36) private String settlesExpenseId;

    /** When the money moved, which is not necessarily when the row was written. */
    @Column(name = "settled_at", nullable = false) private Instant settledAt;

    /** The account that recorded it, which need not be either party (a ghost cannot log in). */
    @Column(name = "recorded_by_user_id", nullable = false) private Long recordedByUserId;

    /**
     * Safeguard two. A mistyped settlement would otherwise be permanent, so reversal writes this
     * to REVERSED and appends a reversal ledger entry rather than deleting anything.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TallySettlementStatus status = TallySettlementStatus.ACTIVE;

    @Column(name = "idempotency_key", length = 64) private String idempotencyKey;

    @CreationTimestamp @Column(nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(nullable = false)                    private Instant updatedAt;

    public boolean isActive() {
        return status == TallySettlementStatus.ACTIVE;
    }
}
