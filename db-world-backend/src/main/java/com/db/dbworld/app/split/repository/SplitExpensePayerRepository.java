package com.db.dbworld.app.split.repository;

import com.db.dbworld.app.split.entity.SplitExpensePayerEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;

public interface SplitExpensePayerRepository extends JpaRepository<SplitExpensePayerEntity, String> {

    List<SplitExpensePayerEntity> findByExpenseId(String expenseId);

    List<SplitExpensePayerEntity> findByExpenseIdIn(Collection<String> expenseIds);

    /** What each member has actually put in across the group's live expenses. */
    @Query("""
            select p.memberId as memberId, sum(p.amount) as total
              from SplitExpensePayerEntity p
              join SplitExpenseEntity e on e.id = p.expenseId
             where e.groupId = :groupId
               and e.status = com.db.dbworld.app.split.entity.SplitExpenseStatus.ACTIVE
             group by p.memberId
            """)
    List<SplitLedgerEntryRepository.MemberTotal> sumPaidByGroup(@Param("groupId") String groupId);

    @Query("select coalesce(sum(p.amount), 0) from SplitExpensePayerEntity p where p.expenseId = :expenseId")
    BigDecimal sumByExpense(@Param("expenseId") String expenseId);

    /** One of the eight member-id references a ghost claim repoints; the list is in
     *  {@link SplitLedgerEntryRepository}. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update SplitExpensePayerEntity p set p.memberId = :survivorId where p.memberId = :loserId")
    int repointPayer(@Param("survivorId") String survivorId, @Param("loserId") String loserId);
}
