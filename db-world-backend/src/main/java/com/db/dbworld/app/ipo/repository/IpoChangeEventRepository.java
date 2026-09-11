package com.db.dbworld.app.ipo.repository;

import com.db.dbworld.app.ipo.entity.IpoChangeEventEntity;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface IpoChangeEventRepository extends JpaRepository<IpoChangeEventEntity, String> {
    List<IpoChangeEventEntity> findTop50ByOrderByCreatedAtDesc();

    /**
     * Events still awaiting a user-facing push, oldest first so alerts arrive in the order they
     * happened. Scoped to the notifiable event types so the audit-only rows (a NEW listing, a date
     * correction) are never even loaded — those keep {@code notifiedAt} null forever by design.
     */
    List<IpoChangeEventEntity> findByEventTypeInAndNotifiedAtIsNullOrderByCreatedAtAsc(
            Collection<String> eventTypes);

    /**
     * How many pushes actually went out since {@code since} — the input to the daily cap.
     *
     * <p>Two things make this a DISTINCT count of {@code pushedAt} rather than a plain row count.
     * First, {@code notifiedAt} is stamped on suppressed events too, so counting that would report
     * a silent day as a noisy one. Second, the cap is about how often a phone buzzes, and one
     * digest push covers several events — every event in a given push is stamped with that push's
     * own instant, so the distinct count is exactly the number of notifications delivered.
     */
    @Query("select count(distinct e.pushedAt) from IpoChangeEventEntity e where e.pushedAt >= :since")
    long countPushesSince(@Param("since") Instant since);

    /**
     * The most recent DELIVERED events for one IPO and event type, newest first — the input to both
     * the per-IPO cooldown ("when did we last buzz about this?") and the GMP baseline ("what value
     * did we last announce?"). Bounded by {@code limit} so the cooldown check is a single indexed
     * row read.
     */
    @Query("""
            select e from IpoChangeEventEntity e
            where e.ipoId = :ipoId and e.eventType = :eventType and e.pushedAt is not null
            order by e.pushedAt desc
            """)
    List<IpoChangeEventEntity> findRecentPushed(@Param("ipoId") String ipoId,
                                                @Param("eventType") String eventType,
                                                Limit limit);

    /**
     * Moves a merged-away duplicate's audit trail onto the surviving row, so the admin change feed
     * for that IPO stays whole. No uniqueness to collide with here — the table is append-only.
     */
    @Modifying
    @Query("update IpoChangeEventEntity e set e.ipoId = :survivorId where e.ipoId = :loserId")
    int repointToSurvivor(@Param("survivorId") String survivorId, @Param("loserId") String loserId);
}
