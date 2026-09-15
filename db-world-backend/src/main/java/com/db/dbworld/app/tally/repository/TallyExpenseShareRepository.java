package com.db.dbworld.app.tally.repository;

import com.db.dbworld.app.tally.entity.TallyExpenseShareEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface TallyExpenseShareRepository extends JpaRepository<TallyExpenseShareEntity, String> {

    List<TallyExpenseShareEntity> findByExpenseId(String expenseId);

    List<TallyExpenseShareEntity> findByExpenseIdIn(Collection<String> expenseIds);

    /**
     * What each member is liable for across the group's live expenses.
     *
     * <p>Groups by {@code owedByMemberId}, not by beneficiary: this is the "who owes" report,
     * and the two are different questions by design. The beneficiary view is the same rows
     * grouped the other way, which is the whole reason both columns exist.
     */
    @Query("""
            select s.owedByMemberId as memberId, sum(s.amount) as total
              from TallyExpenseShareEntity s
              join TallyExpenseEntity e on e.id = s.expenseId
             where e.groupId = :groupId
               and e.status = com.db.dbworld.app.tally.entity.TallyExpenseStatus.ACTIVE
             group by s.owedByMemberId
            """)
    List<TallyLedgerEntryRepository.MemberTotal> sumOwedByGroup(@Param("groupId") String groupId);

    /** The same rows grouped by who actually consumed — "where did the money go". */
    @Query("""
            select s.beneficiaryMemberId as memberId, sum(s.amount) as total
              from TallyExpenseShareEntity s
              join TallyExpenseEntity e on e.id = s.expenseId
             where e.groupId = :groupId
               and e.status = com.db.dbworld.app.tally.entity.TallyExpenseStatus.ACTIVE
             group by s.beneficiaryMemberId
            """)
    List<TallyLedgerEntryRepository.MemberTotal> sumConsumedByGroup(@Param("groupId") String groupId);

    @Query("select coalesce(sum(s.amount), 0) from TallyExpenseShareEntity s where s.expenseId = :expenseId")
    BigDecimal sumByExpense(@Param("expenseId") String expenseId);

    /**
     * Moves a claimed ghost's liability onto the surviving member.
     *
     * <p>Two of the eight member-id references a ghost claim has to repoint. Both must move: the
     * beneficiary preserves who consumed, the owed-by preserves who pays, and repointing only
     * one silently rewrites history into a delegation that never happened.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update TallyExpenseShareEntity s set s.beneficiaryMemberId = :survivorId where s.beneficiaryMemberId = :loserId")
    int repointBeneficiary(@Param("survivorId") String survivorId, @Param("loserId") String loserId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update TallyExpenseShareEntity s set s.owedByMemberId = :survivorId where s.owedByMemberId = :loserId")
    int repointOwedBy(@Param("survivorId") String survivorId, @Param("loserId") String loserId);

    /**
     * How many of the loser's rows sit on an expense the survivor is already on, ahead of a
     * ghost claim. {@code uk_tally_expense_share_expense_beneficiary} allows each member once per expense, so repointing
     * those would hit the key.
     *
     * <p>A SELECT with a self-referencing subquery, which is fine: MySQL error 1093 forbids
     * reading the table you are <em>writing</em>, so it applies to the bulk UPDATE and DELETE
     * forms and not to a plain count like this one.
     */
    @Query("""
            select count(s) from TallyExpenseShareEntity s
             where s.beneficiaryMemberId = :loserId
               and exists (select 1 from TallyExpenseShareEntity other
                           where other.expenseId = s.expenseId
                             and other.beneficiaryMemberId = :survivorId)
            """)
    long countMergeCollisions(@Param("survivorId") String survivorId, @Param("loserId") String loserId);

    /** One share of one expense, flattened with the bits of the expense a report needs. */
    interface ConsumedShare {
        String getExpenseId();
        LocalDate getExpenseDate();
        String getDescription();
        String getCategory();
        String getGroupId();
        BigDecimal getAmount();
    }

    /**
     * Every share the caller consumed across their ledgers in a date range.
     *
     * <h2>Why this is filtered by group and not just by member</h2>
     * The obvious query — join the member rows for this user and take their shares — has no
     * index to stand on: the only key over {@code beneficiary_member_id} is
     * {@code uk_tally_expense_share_expense_beneficiary}, which leads with {@code expense_id}, so
     * a beneficiary-first lookup scans the table. Leading with the caller's groups and the date
     * instead matches {@code idx_tally_expense_group_date} exactly
     * ({@code group_id, status, expense_date, id}), and the shares are then reached by
     * {@code expense_id}, which is indexed. The member filter is left as a cheap predicate on the
     * handful of rows that survive.
     *
     * <p>That matters more than usual here: the module has no migration tooling, so an index
     * added to suit a query would not appear on a database that already exists.
     *
     * <p>Returns rows rather than a {@code group by} so one trip answers every part of the
     * report — the chart, the categories, the ledgers, the count and the largest single item.
     * A period holds at most a few thousand shares for even a heavy user, where four aggregate
     * round trips would cost more than the rows do.
     */
    @Query("""
            select e.id as expenseId, e.expenseDate as expenseDate, e.description as description,
                   e.category as category, e.groupId as groupId, s.amount as amount
              from TallyExpenseShareEntity s
              join TallyExpenseEntity e on e.id = s.expenseId
             where e.groupId in :groupIds
               and e.status = com.db.dbworld.app.tally.entity.TallyExpenseStatus.ACTIVE
               and e.expenseDate between :from and :to
               and s.beneficiaryMemberId in :memberIds
            """)
    List<ConsumedShare> findConsumed(@Param("groupIds") Collection<String> groupIds,
                                     @Param("memberIds") Collection<String> memberIds,
                                     @Param("from") LocalDate from,
                                     @Param("to") LocalDate to);

    /** The same total on its own, for the previous period's comparison figure. */
    @Query("""
            select coalesce(sum(s.amount), 0)
              from TallyExpenseShareEntity s
              join TallyExpenseEntity e on e.id = s.expenseId
             where e.groupId in :groupIds
               and e.status = com.db.dbworld.app.tally.entity.TallyExpenseStatus.ACTIVE
               and e.expenseDate between :from and :to
               and s.beneficiaryMemberId in :memberIds
            """)
    BigDecimal sumConsumed(@Param("groupIds") Collection<String> groupIds,
                           @Param("memberIds") Collection<String> memberIds,
                           @Param("from") LocalDate from,
                           @Param("to") LocalDate to);
}
