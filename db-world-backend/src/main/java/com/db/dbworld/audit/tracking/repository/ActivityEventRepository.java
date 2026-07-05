package com.db.dbworld.audit.tracking.repository;

import com.db.dbworld.audit.tracking.admin.dto.SessionEventProjection;
import com.db.dbworld.audit.tracking.entity.ActivityEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface ActivityEventRepository extends JpaRepository<ActivityEventEntity, Long> {
    boolean existsBySessionIdAndClientEventId(String sessionId, String clientEventId);
    long deleteByEventTimeBefore(Instant cutoff);

    /** Ordered event timeline for a single session — backs the admin Activity console's session detail drawer. */
    @Query(value = """
            SELECT
                id                  AS id,
                event_time          AS eventTime,
                event_type          AS eventType,
                source              AS source,
                bytes_delta         AS bytesDelta,
                cumulative_bytes    AS cumulativeBytes,
                speed_bps           AS speedBps,
                connections         AS connections,
                position_ms         AS positionMs,
                completion_percent  AS completionPercent,
                error_code          AS errorCode,
                error_message       AS errorMessage
            FROM activity_event
            WHERE session_id = :sessionId
            ORDER BY event_time ASC
            """, nativeQuery = true)
    List<SessionEventProjection> findEventsBySessionIdOrderByEventTime(@Param("sessionId") String sessionId);
}
