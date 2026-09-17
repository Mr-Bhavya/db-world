package com.db.dbworld.app.tally.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Money actually handed over for an expense, by one member.
 *
 * <p>A table rather than a {@code paid_by} column on the expense, because two people splitting
 * the bill at the till is ordinary. The payer amounts must sum to the expense total, asserted
 * before any row is written.
 */
@Entity
@Table(name = "tally_expense_payer", schema = "db_world",
        uniqueConstraints = {
            // Without this a double-submit writes the same payer twice and the expense
            // reconciles to twice its total -- silently, because each row looks correct alone.
            @UniqueConstraint(name = "uk_tally_expense_payer_expense_member",
                    columnNames = {"expense_id", "member_id"})
        },
        indexes = {
            @Index(name = "idx_tally_expense_payer_expense", columnList = "expense_id")
        })
@Getter @Setter @NoArgsConstructor
public class TallyExpensePayerEntity {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "expense_id", nullable = false, length = 36) private String expenseId;
    @Column(name = "member_id", nullable = false, length = 36)  private String memberId;

    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal amount;

    @CreationTimestamp @Column(nullable = false, updatable = false) private Instant createdAt;
}
