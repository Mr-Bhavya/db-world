package com.db.dbworld.app.tally.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * One participant's slice of an expense — and, separately, who is on the hook for it.
 *
 * <p>{@link #beneficiaryMemberId} is who consumed; {@link #owedByMemberId} is who owes. Keeping
 * the two apart is the premise of the whole module: "the kids ate, dad pays" is one row naming
 * two different members, and it turns "where did the money go" and "who owes what" into two
 * genuinely different reports rather than the single conflated one Splitwise offers.
 *
 * <p><b>{@code owedByMemberId} is never null</b> — it equals the beneficiary when nobody has
 * delegated. A nullable column would force every balance query through
 * {@code COALESCE(owed_by, beneficiary)}, which no index can serve, and the balance read is the
 * hottest path here. It is also a <em>snapshot</em>: it records the delegation as it stood when
 * the expense was written, so changing a standing delegation later never silently rewrites who
 * owed what for a dinner three months ago.
 */
@Entity
@Table(name = "tally_expense_share", schema = "db_world",
        uniqueConstraints = {
            // One slice per beneficiary per expense. Same reasoning as the payer key: without
            // it a retry doubles the shares and the expense stops summing to its total.
            @UniqueConstraint(name = "uk_tally_expense_share_expense_beneficiary",
                    columnNames = {"expense_id", "beneficiary_member_id"})
        },
        indexes = {
            @Index(name = "idx_tally_expense_share_expense", columnList = "expense_id"),
            // "What am I liable for" reads by owed_by, which the unique key above cannot serve.
            @Index(name = "idx_tally_expense_share_owed", columnList = "owed_by_member_id")
        })
@Getter @Setter @NoArgsConstructor
public class TallyExpenseShareEntity {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "expense_id", nullable = false, length = 36) private String expenseId;

    /** Who consumed this slice. */
    @Column(name = "beneficiary_member_id", nullable = false, length = 36)
    private String beneficiaryMemberId;

    /** Who settles it — equal to the beneficiary unless delegated. Never null; see class javadoc. */
    @Column(name = "owed_by_member_id", nullable = false, length = 36)
    private String owedByMemberId;

    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal amount;

    /**
     * The input that produced {@link #amount}, kept so an expense can be re-opened and edited
     * with its original weights rather than reverse-engineered from the rounded rupees.
     *
     * <p>Scale 4, not 2: a percentage needs the extra digits, and "a third of the bill" is not
     * the same allocation as a flat 33.33 percent.
     */
    @Column(name = "share_weight", precision = 12, scale = 4)  private BigDecimal shareWeight;
    @Column(name = "share_percent", precision = 12, scale = 4) private BigDecimal sharePercent;

    @CreationTimestamp @Column(nullable = false, updatable = false) private Instant createdAt;

    /** True when this slice was not delegated — the member consumed it and owes it themselves. */
    public boolean isSelfOwed() {
        return beneficiaryMemberId.equals(owedByMemberId);
    }
}
