package com.db.dbworld.app.ipo.repository;

import com.db.dbworld.app.ipo.entity.IpoChangeEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
