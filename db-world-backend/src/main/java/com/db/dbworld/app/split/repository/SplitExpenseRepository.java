package com.db.dbworld.app.split.repository;

import com.db.dbworld.app.split.entity.SplitExpenseEntity;
import com.db.dbworld.app.split.entity.SplitExpenseStatus;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SplitExpenseRepository extends JpaRepository<SplitExpenseEntity, String> {

    Optional<SplitExpenseEntity> findByIdAndGroupId(String id, String groupId);

    /** Idempotent replay: the same token in the same group returns the original write. */
    Optional<SplitExpenseEntity> findByGroupIdAndIdempotencyKey(String groupId, String idempotencyKey);

    List<SplitExpenseEntity> findByGroupIdAndStatus(String groupId, SplitExpenseStatus status);

    /* ========================= keyset pagination =========================
     *
     * Keyset, not OFFSET. expense_date is a DATE, so a group with several expenses on the same
     * day has no total order under OFFSET alone: inserting one row shifts the window and the
     * reader both sees a duplicate and skips a different row. Paging on the full (date, id)
     * tuple is stable regardless of what is written between requests.
     *
     * The tuple comparison is expanded by hand rather than written as
     * `(e.expenseDate, e.id) < (:date, :id)`. HQL renders row-value comparisons differently per
     * dialect and some emulate them with a form no index can use; the expanded predicate below
     * matches idx_split_expense_group_date on every database.
     *
     * Two methods rather than one with a nullable cursor, because `:cursor is null or ...` puts
     * an untyped NULL parameter into the WHERE clause, which Hibernate and the driver have to
     * agree about -- and it makes the first page's plan depend on a runtime value.
     */

    /** First page, newest first. */
    @Query("""
            select e from SplitExpenseEntity e
             where e.groupId = :groupId
               and e.status = :status
             order by e.expenseDate desc, e.id desc
            """)
    List<SplitExpenseEntity> findFirstPage(@Param("groupId") String groupId,
                                           @Param("status") SplitExpenseStatus status,
                                           Limit limit);

    /** Subsequent pages: everything strictly older than the cursor. */
    @Query("""
            select e from SplitExpenseEntity e
             where e.groupId = :groupId
               and e.status = :status
               and (e.expenseDate < :cursorDate
                    or (e.expenseDate = :cursorDate and e.id < :cursorId))
             order by e.expenseDate desc, e.id desc
            """)
    List<SplitExpenseEntity> findPageAfter(@Param("groupId") String groupId,
                                           @Param("status") SplitExpenseStatus status,
                                           @Param("cursorDate") LocalDate cursorDate,
                                           @Param("cursorId") String cursorId,
                                           Limit limit);
}
