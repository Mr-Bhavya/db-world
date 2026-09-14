package com.db.dbworld.app.tally.repository;

import com.db.dbworld.app.tally.entity.TallyExpensePayerEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;

public interface TallyExpensePayerRepository extends JpaRepository<TallyExpensePayerEntity, String> {

    List<TallyExpensePayerEntity> findByExpenseId(String expenseId);

    List<TallyExpensePayerEntity> findByExpenseIdIn(Collection<String> expenseIds);

    /** What each member has actually put in across the group's live expenses. */
    @Query("""
            select p.memberId as memberId, sum(p.amount) as total
              from TallyExpensePayerEntity p
              join TallyExpenseEntity e on e.id = p.expenseId
             where e.groupId = :groupId
               and e.status = com.db.dbworld.app.tally.entity.TallyExpenseStatus.ACTIVE
             group by p.memberId
            """)
    List<TallyLedgerEntryRepository.MemberTotal> sumPaidByGroup(@Param("groupId") String groupId);

    @Query("select coalesce(sum(p.amount), 0) from TallyExpensePayerEntity p where p.expenseId = :expenseId")
    BigDecimal sumByExpense(@Param("expenseId") String expenseId);

    /** One of the eight member-id references a ghost claim repoints; the list is in
     *  {@link TallyLedgerEntryRepository}. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update TallyExpensePayerEntity p set p.memberId = :survivorId where p.memberId = :loserId")
    int repointPayer(@Param("survivorId") String survivorId, @Param("loserId") String loserId);
}
