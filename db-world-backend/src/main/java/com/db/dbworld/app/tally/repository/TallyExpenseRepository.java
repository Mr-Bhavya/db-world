package com.db.dbworld.app.tally.repository;

import com.db.dbworld.app.tally.entity.TallyExpenseEntity;
import com.db.dbworld.app.tally.entity.TallyExpenseStatus;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TallyExpenseRepository extends JpaRepository<TallyExpenseEntity, String> {

    Optional<TallyExpenseEntity> findByIdAndGroupId(String id, String groupId);

    /** Idempotent replay: the same token in the same group returns the original write. */
    Optional<TallyExpenseEntity> findByGroupIdAndIdempotencyKey(String groupId, String idempotencyKey);

    List<TallyExpenseEntity> findByGroupIdAndStatus(String groupId, TallyExpenseStatus status);

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
     * matches idx_tally_expense_group_date on every database.
     *
     * Two methods rather than one with a nullable cursor, because `:cursor is null or ...` puts
     * an untyped NULL parameter into the WHERE clause, which Hibernate and the driver have to
     * agree about -- and it makes the first page's plan depend on a runtime value.
     */

    /** First page, newest first. */
    @Query("""
            select e from TallyExpenseEntity e
             where e.groupId = :groupId
               and e.status = :status
             order by e.expenseDate desc, e.id desc
            """)
    List<TallyExpenseEntity> findFirstPage(@Param("groupId") String groupId,
                                           @Param("status") TallyExpenseStatus status,
                                           Limit limit);

    /** Subsequent pages: everything strictly older than the cursor. */
    /**
     * Every live expense in one group over a date range, for the group's report.
     *
     * <p>Matches {@code idx_tally_expense_group_date} on its first three columns
     * ({@code group_id, status, expense_date}) with a single group id, so this is a plain index
     * range scan. The rows themselves carry everything the report needs — total, category, date
     * and description — so the chart, the categories, the count and the largest item come from
     * this one read rather than four aggregates.
     */
    List<TallyExpenseEntity> findByGroupIdAndStatusAndExpenseDateBetween(
            String groupId, TallyExpenseStatus status, LocalDate from, LocalDate to);

    /** The same total on its own, for the previous period's comparison figure. */
    @Query("""
            select coalesce(sum(e.totalAmount), 0)
              from TallyExpenseEntity e
             where e.groupId = :groupId
               and e.status = com.db.dbworld.app.tally.entity.TallyExpenseStatus.ACTIVE
               and e.expenseDate between :from and :to
            """)
    BigDecimal sumTotalBetween(@Param("groupId") String groupId,
                               @Param("from") LocalDate from,
                               @Param("to") LocalDate to);

    @Query("""
            select e from TallyExpenseEntity e
             where e.groupId = :groupId
               and e.status = :status
               and (e.expenseDate < :cursorDate
                    or (e.expenseDate = :cursorDate and e.id < :cursorId))
             order by e.expenseDate desc, e.id desc
            """)
    List<TallyExpenseEntity> findPageAfter(@Param("groupId") String groupId,
                                           @Param("status") TallyExpenseStatus status,
                                           @Param("cursorDate") LocalDate cursorDate,
                                           @Param("cursorId") String cursorId,
                                           Limit limit);
}
