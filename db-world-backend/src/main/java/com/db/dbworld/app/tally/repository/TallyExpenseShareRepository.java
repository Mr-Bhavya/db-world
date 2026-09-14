package com.db.dbworld.app.tally.repository;

import com.db.dbworld.app.tally.entity.TallyExpenseShareEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
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
}
