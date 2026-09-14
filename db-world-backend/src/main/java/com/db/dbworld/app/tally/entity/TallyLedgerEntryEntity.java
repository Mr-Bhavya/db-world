package com.db.dbworld.app.tally.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * "{@code from} owes {@code to} this much" — one directed, append-only debt edge.
 *
 * <h2>Why a ledger exists at all</h2>
 * Shares and settlements could in principle be summed directly. They cannot once an expense has
 * <em>multiple payers</em>: mapping "who consumed" onto "who owes whom" then requires a pro-rata
 * allocation choice that is recorded nowhere else. Not persisting it means recomputing it
 * identically forever — including for rows written by an older version of the algorithm. That is
 * the same problem snapshotting the delegation already solves, and it has the same answer.
 *
 * <p>So this is a <b>derived projection, not the source of truth.</b> Shares and payers are
 * authoritative; the ledger is written from them in the same transaction, and a reconciliation
 * test asserts the two agree. Reads never have to choose: balances always come from the ledger,
 * expense detail always from the shares.
 *
 * <h2>Write-time rules</h2>
 * <ul>
 *   <li>{@link #amount} is strictly positive. Direction lives in from/to, so a negative amount
 *       would be a second way to say the same thing and would break the covering indexes.</li>
 *   <li>{@code from != to}. A self-edge nets to nothing; store nothing.</li>
 *   <li>Nothing is ever updated or deleted. Undoing a posting means writing its
 *       {@link TallyLedgerEntryType#REVERSAL}, which is <b>the same edge with from and to
 *       swapped</b> — not a negative amount. The pair then sums to zero on its own, so a
 *       balance is a plain {@code SUM} over every row regardless of entry type, and no query
 *       has to know what a reversal is.</li>
 * </ul>
 */
@Entity
@Table(name = "tally_ledger_entry", schema = "db_world",
        indexes = {
            // The two balance reads, one per direction. The trailing amount makes both COVERING:
            // the sum is answered from the index without touching the row. ddl-auto never widens
            // an existing index, so a 2-column version shipped today could not be extended later
            // without a manual migration -- which is why the third column is here from the start.
            //
            // Per-member balances are served by these same two via the (group_id, member_id)
            // prefix. Do NOT add a member-only index; it would be redundant and write-amplifying.
            @Index(name = "idx_tally_ledger_entry_group_to",
                    columnList = "group_id, to_member_id, amount"),
            @Index(name = "idx_tally_ledger_entry_group_from",
                    columnList = "group_id, from_member_id, amount"),
            // Load-bearing for voiding: find every entry a given expense or settlement produced
            // so it can be reversed.
            @Index(name = "idx_tally_ledger_entry_source",
                    columnList = "source_type, source_id")
        })
@Getter @Setter @NoArgsConstructor
public class TallyLedgerEntryEntity {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(name = "group_id", nullable = false, length = 36) private String groupId;

    /** The debtor. */
    @Column(name = "from_member_id", nullable = false, length = 36) private String fromMemberId;
    /** The creditor. */
    @Column(name = "to_member_id", nullable = false, length = 36)   private String toMemberId;

    /** Strictly greater than zero — see the class javadoc. */
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 20)
    private TallyLedgerSourceType sourceType;

    /**
     * Posting or undo. A separate column from {@link #sourceType} on purpose: folding REVERSAL
     * in there as a third source type would lose which kind of thing was reversed, and getting
     * that back later means a data migration over an append-only table.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "entry_type", nullable = false, length = 20)
    private TallyLedgerEntryType entryType = TallyLedgerEntryType.ORIGINAL;

    /** Id of the expense or settlement that produced this entry. */
    @Column(name = "source_id", nullable = false, length = 36) private String sourceId;

    // No updatedAt: the table is append-only, and offering one would invite an UPDATE.
    @CreationTimestamp @Column(nullable = false, updatable = false) private Instant createdAt;
}
