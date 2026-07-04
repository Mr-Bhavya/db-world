package com.db.dbworld.audit.tracking.repository;

import com.db.dbworld.audit.tracking.entity.ActivityEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.Instant;

@Repository
public interface ActivityEventRepository extends JpaRepository<ActivityEventEntity, Long> {
    boolean existsBySessionIdAndClientEventId(String sessionId, String clientEventId);
    long deleteByEventTimeBefore(Instant cutoff);
}
