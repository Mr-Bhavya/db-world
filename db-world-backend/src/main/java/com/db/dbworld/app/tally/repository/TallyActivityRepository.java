package com.db.dbworld.app.tally.repository;

import com.db.dbworld.app.tally.entity.TallyActivityAction;
import com.db.dbworld.app.tally.entity.TallyActivityEntity;
import com.db.dbworld.app.tally.entity.TallyActivitySubject;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface TallyActivityRepository extends JpaRepository<TallyActivityEntity, String> {

    /* ========================= the group's feed =========================
     *
     * Keyset again, on (createdAt, id) descending, for the same reason the expense feed is:
     * OFFSET over a list that is actively being appended to both duplicates and skips rows.
     * Here it matters more -- one user action writes several activity rows at once, so the
     * timestamps genuinely collide and `id` is doing real work as the tie-break rather than
     * being a formality.
     *
     * Two methods rather than one nullable cursor: `:cursor is null or ...` puts an untyped
     * NULL into the WHERE clause and makes the first page's plan depend on a runtime value.
     */

    @Query("""
            select a from TallyActivityEntity a
             where a.groupId = :groupId
             order by a.createdAt desc, a.id desc
            """)
    List<TallyActivityEntity> findFirstPage(@Param("groupId") String groupId, Limit limit);

    @Query("""
            select a from TallyActivityEntity a
             where a.groupId = :groupId
               and (a.createdAt < :cursorAt
                    or (a.createdAt = :cursorAt and a.id < :cursorId))
             order by a.createdAt desc, a.id desc
            """)
    List<TallyActivityEntity> findPageAfter(@Param("groupId") String groupId,
                                            @Param("cursorAt") Instant cursorAt,
                                            @Param("cursorId") String cursorId,
                                            Limit limit);

    /** Everything that has happened to one expense, settlement or member. */
    List<TallyActivityEntity> findBySubjectTypeAndSubjectIdOrderByCreatedAtAsc(
            TallyActivitySubject subjectType, String subjectId);

    /**
     * Whether this expense has already been put back.
     *
     * <p>Restoring posts a <em>copy</em> — the original stays voided, because its reversal is
     * an append-only ledger row and there is no such thing as un-reversing it. So without this
     * check, tapping Restore twice quietly creates the expense twice, and the second one looks
     * exactly as legitimate as the first.
     */
    boolean existsBySubjectTypeAndSubjectIdAndAction(
            TallyActivitySubject subjectType, String subjectId, TallyActivityAction action);

    /** Every expense in this group that has already been put back, for one page of history. */
    @Query("""
            select a.subjectId from TallyActivityEntity a
             where a.groupId = :groupId
               and a.action = com.db.dbworld.app.tally.entity.TallyActivityAction.EXPENSE_RESTORED
               and a.subjectId is not null
            """)
    List<String> findRestoredSubjectIds(@Param("groupId") String groupId);
}
