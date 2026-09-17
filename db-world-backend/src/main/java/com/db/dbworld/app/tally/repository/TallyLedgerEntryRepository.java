package com.db.dbworld.app.tally.repository;

import com.db.dbworld.app.tally.entity.TallyLedgerEntryEntity;
import com.db.dbworld.app.tally.entity.TallyLedgerSourceType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface TallyLedgerEntryRepository extends JpaRepository<TallyLedgerEntryEntity, String> {

    /** One member's total on one side of the ledger. */
    interface MemberTotal {
        String getMemberId();
        BigDecimal getTotal();
    }

    /* ============================== balances ============================== */

    /*
     * Credits and debits are two queries rather than one, and that is the point rather than a
     * compromise. Each reads exactly one of the two covering indexes
     * (idx_tally_ledger_entry_group_to / _group_from) and is answered from the index without
     * touching a row. Folding them into a single statement would need a UNION or an OR across
     * from_member_id and to_member_id, and an OR across two different columns cannot use either
     * index -- turning the cheapest read in the module into a scan of the group's whole history.
     *
     * Reversals need no special handling: a reversal is the same edge with from and to swapped,
     * so the pair cancels inside these sums on its own.
     */

    /** What each member is owed. */
    @Query("""
            select e.toMemberId as memberId, sum(e.amount) as total
              from TallyLedgerEntryEntity e
             where e.groupId = :groupId
             group by e.toMemberId
            """)
    List<MemberTotal> sumCreditsByGroup(@Param("groupId") String groupId);

    /** What each member owes. */
    @Query("""
            select e.fromMemberId as memberId, sum(e.amount) as total
              from TallyLedgerEntryEntity e
             where e.groupId = :groupId
             group by e.fromMemberId
            """)
    List<MemberTotal> sumDebitsByGroup(@Param("groupId") String groupId);

    /**
     * A single member's net position, as {@code credits - debits}.
     *
     * <p>Exists as its own query because member removal has to answer "is this exactly zero"
     * inside the removal transaction, and loading the whole group's balance map to read one
     * number would be the wrong shape for the one check that guards against money vanishing.
     */
    @Query("""
            select coalesce((select sum(c.amount) from TallyLedgerEntryEntity c
                              where c.groupId = :groupId and c.toMemberId = :memberId), 0)
                 - coalesce((select sum(d.amount) from TallyLedgerEntryEntity d
                              where d.groupId = :groupId and d.fromMemberId = :memberId), 0)
            """)
    BigDecimal netBalanceOf(@Param("groupId") String groupId, @Param("memberId") String memberId);

    /*
     * A note on the group-closure invariant, because it is easy to write a version of it that
     * proves nothing.
     *
     * "Sum over all members of (credits - debits) == 0" is TRUE BY CONSTRUCTION here: every row
     * contributes its amount once as somebody's credit and once as somebody's debit, so the two
     * totals are the same sum and cancel. Asserting it against the ledger alone would pass even
     * if the allocator lost paise on every expense.
     *
     * The assertion with teeth is the RECONCILIATION: for each member, the ledger's net must
     * equal what the authoritative tables say -- paid minus owed, adjusted by settlements. The
     * ledger is a projection, and the only bug worth catching is the projection disagreeing with
     * its source. That check is assembled from this repository plus the payer, share and
     * settlement repositories; see the reconciliation test.
     */

    /* ============================== reversal ============================== */

    /** Every entry a given expense or settlement produced; served by {@code idx_..._source}. */
    List<TallyLedgerEntryEntity> findBySourceTypeAndSourceId(TallyLedgerSourceType sourceType,
                                                             String sourceId);

    List<TallyLedgerEntryEntity> findByGroupId(String groupId);

    /* ============================== ghost claim ==============================
     *
     * The append-only rule is about the LEDGER'S CONTENT -- no amount, direction or source is
     * ever rewritten, and an undo is a new row. A claim rewrites none of those: it merges two
     * member rows that were always the same person, so the edges stay identical and only the id
     * they name changes. Leaving these two columns behind would strand the ghost's whole history
     * on a tombstoned member and the balances would simply stop adding up.
     *
     * These are two of the EIGHT columns in the module that reference a member id:
     *   1. tally_expense_payer.member_id
     *   2. tally_expense_share.beneficiary_member_id
     *   3. tally_expense_share.owed_by_member_id
     *   4. tally_ledger_entry.from_member_id            <- here
     *   5. tally_ledger_entry.to_member_id              <- here
     *   6. tally_settlement.from_member_id
     *   7. tally_settlement.to_member_id
     *   8. tally_group_member.paid_for_by_member_id     <- self-referencing, the forgotten one
     */

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update TallyLedgerEntryEntity e set e.fromMemberId = :survivorId where e.fromMemberId = :loserId")
    int repointFrom(@Param("survivorId") String survivorId, @Param("loserId") String loserId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update TallyLedgerEntryEntity e set e.toMemberId = :survivorId where e.toMemberId = :loserId")
    int repointTo(@Param("survivorId") String survivorId, @Param("loserId") String loserId);
}
