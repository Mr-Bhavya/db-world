package com.db.dbworld.audit.tracking.repository;

import com.db.dbworld.audit.tracking.admin.dto.ClientBreakdownProjection;
import com.db.dbworld.audit.tracking.admin.dto.LiveSessionProjection;
import com.db.dbworld.audit.tracking.admin.dto.OverviewProjection;
import com.db.dbworld.audit.tracking.admin.dto.TopContentProjection;
import com.db.dbworld.audit.tracking.admin.dto.TopUserProjection;
import com.db.dbworld.audit.tracking.admin.dto.TrendProjection;
import com.db.dbworld.audit.tracking.entity.ActivitySessionEntity;
import com.db.dbworld.audit.tracking.enums.ActivityKind;
import com.db.dbworld.audit.tracking.enums.SessionState;
import com.db.dbworld.audit.tracking.enums.TrackChannel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface ActivitySessionRepository
        extends JpaRepository<ActivitySessionEntity, String>,
                JpaSpecificationExecutor<ActivitySessionEntity> {

    List<ActivitySessionEntity> findByStateInAndLastEventAtBefore(List<SessionState> states, Instant cutoff);

    /**
     * Dynamic-filter search for the admin Activity console's sessions table.
     * Filters are applied only when non-null — modeled on
     * {@code UserActivityLogRepository#findByFilters}. Date range filters on
     * {@code lastEventAt} (the column most indicative of session recency).
     */
    default Page<ActivitySessionEntity> search(
            Long userId, ActivityKind activity, TrackChannel channel, String clientApp,
            SessionState state, Long recordId, Instant from, Instant to,
            Pageable pageable) {

        // Spring Data 4 added Specification.where(PredicateSpecification) — the bare
        // .where(null) call is now ambiguous. Start with an always-true conjunction.
        Specification<ActivitySessionEntity> spec = (root, q, cb) -> cb.conjunction();

        if (userId != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("userId"), userId));
        }
        if (activity != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("activity"), activity));
        }
        if (channel != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("channel"), channel));
        }
        if (clientApp != null && !clientApp.isBlank()) {
            spec = spec.and((root, q, cb) ->
                    cb.like(cb.lower(root.get("clientApp")), "%" + clientApp.toLowerCase() + "%"));
        }
        if (state != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("state"), state));
        }
        if (recordId != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("recordId"), recordId));
        }
        if (from != null) {
            spec = spec.and((root, q, cb) -> cb.greaterThanOrEqualTo(root.get("lastEventAt"), from));
        }
        if (to != null) {
            spec = spec.and((root, q, cb) -> cb.lessThanOrEqualTo(root.get("lastEventAt"), to));
        }

        return findAll(spec, pageable);
    }

    /**
     * Headline KPI aggregate over the trailing {@code :days} window
     * (excludes the "active right now" count, which is time-sensitive and
     * queried separately via {@link #countLiveSessions}).
     */
    @Query(value = """
            SELECT
                SUM(CASE WHEN activity = 'DOWNLOAD' THEN 1 ELSE 0 END) AS downloadsToday,
                SUM(CASE WHEN activity = 'STREAM'   THEN 1 ELSE 0 END) AS streamsToday,
                COUNT(DISTINCT user_id)                                AS uniqueUsers,
                COALESCE(SUM(unique_bytes), 0)                         AS uniqueBytes,
                COALESCE(AVG(avg_speed_bps), 0)                        AS avgSpeedBps,
                SUM(CASE WHEN state = 'COMPLETED' THEN 1 ELSE 0 END)   AS completedCount,
                COUNT(*)                                               AS totalCount
            FROM activity_session
            WHERE last_event_at >= (NOW() - INTERVAL :days DAY)
              AND activity IN ('DOWNLOAD', 'STREAM')
            """, nativeQuery = true)
    OverviewProjection findOverview(@Param("days") int days);

    /** Count of sessions currently ACTIVE/PAUSED with a recent heartbeat — the "active now" KPI. */
    @Query(value = """
            SELECT COUNT(*)
            FROM activity_session
            WHERE state IN ('ACTIVE', 'PAUSED')
              AND last_event_at >= :cutoff
            """, nativeQuery = true)
    long countLiveSessions(@Param("cutoff") Instant cutoff);

    /**
     * Live sessions table: currently ACTIVE/PAUSED sessions with a recent heartbeat,
     * enriched with user email and record title/type via LEFT JOIN (both may be
     * absent for orphaned rows).
     */
    @Query(value = """
            SELECT
                s.session_id         AS sessionId,
                u.email               AS userEmail,
                r.name                AS title,
                s.activity            AS activity,
                s.channel             AS channel,
                s.client_app          AS clientApp,
                s.state               AS state,
                s.completion_percent  AS completionPercent,
                s.avg_speed_bps       AS avgSpeedBps,
                s.max_speed_bps       AS maxSpeedBps,
                s.peak_connections    AS peakConnections,
                s.unique_bytes        AS uniqueBytes,
                s.file_size           AS fileSize,
                s.started_at          AS startedAt,
                s.last_event_at       AS lastEventAt
            FROM activity_session s
            LEFT JOIN users   u ON u.id = s.user_id
            LEFT JOIN records r ON r.id = s.record_id
            WHERE s.state IN ('ACTIVE', 'PAUSED')
              AND s.last_event_at >= :cutoff
            ORDER BY s.last_event_at DESC
            """, nativeQuery = true)
    List<LiveSessionProjection> findLiveSessions(@Param("cutoff") Instant cutoff);

    /** Daily streams/downloads/bytes trend over the trailing {@code :days} window. */
    @Query(value = """
            SELECT
                DATE(last_event_at)                                    AS date,
                SUM(CASE WHEN activity = 'STREAM'   THEN 1 ELSE 0 END) AS streams,
                SUM(CASE WHEN activity = 'DOWNLOAD' THEN 1 ELSE 0 END) AS downloads,
                COALESCE(SUM(unique_bytes), 0)                         AS uniqueBytes
            FROM activity_session
            WHERE last_event_at >= (NOW() - INTERVAL :days DAY)
              AND activity IN ('STREAM', 'DOWNLOAD')
            GROUP BY DATE(last_event_at)
            ORDER BY DATE(last_event_at)
            """, nativeQuery = true)
    List<TrendProjection> findTrend(@Param("days") int days);

    /** Breakdown of recent activity by client_app over the trailing {@code :days} window. */
    @Query(value = """
            SELECT
                client_app AS clientApp,
                COUNT(*)   AS count
            FROM activity_session
            WHERE last_event_at >= (NOW() - INTERVAL :days DAY)
              AND activity IN ('STREAM', 'DOWNLOAD')
              AND client_app IS NOT NULL
            GROUP BY client_app
            ORDER BY count DESC
            """, nativeQuery = true)
    List<ClientBreakdownProjection> findClientBreakdown(@Param("days") int days);

    /** Top content by combined activity (streams + downloads) over the trailing {@code :days} window. */
    @Query(value = """
            SELECT
                s.record_id             AS recordId,
                r.name                  AS title,
                r.type                  AS recordType,
                SUM(CASE WHEN s.activity = 'STREAM'   THEN 1 ELSE 0 END) AS streamCount,
                SUM(CASE WHEN s.activity = 'DOWNLOAD' THEN 1 ELSE 0 END) AS downloadCount,
                COUNT(DISTINCT s.user_id)                                AS uniqueUsers
            FROM activity_session s
            JOIN records r ON r.id = s.record_id
            WHERE s.last_event_at >= (NOW() - INTERVAL :days DAY)
              AND s.activity IN ('STREAM', 'DOWNLOAD')
              AND s.record_id IS NOT NULL
            GROUP BY s.record_id, r.name, r.type
            ORDER BY (SUM(CASE WHEN s.activity = 'STREAM' THEN 1 ELSE 0 END)
                    + SUM(CASE WHEN s.activity = 'DOWNLOAD' THEN 1 ELSE 0 END)) DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<TopContentProjection> findTopContent(@Param("days") int days, @Param("limit") int limit);

    /** Top users by total sessions and bytes delivered over the trailing {@code :days} window. */
    @Query(value = """
            SELECT
                u.id                            AS userId,
                u.email                         AS email,
                MAX(s.last_event_at)            AS lastActive,
                COUNT(s.session_id)             AS totalSessions,
                COALESCE(SUM(s.unique_bytes), 0) AS totalBytes
            FROM activity_session s
            JOIN users u ON u.id = s.user_id
            WHERE s.last_event_at >= (NOW() - INTERVAL :days DAY)
              AND s.activity IN ('STREAM', 'DOWNLOAD')
            GROUP BY u.id, u.email
            ORDER BY totalSessions DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<TopUserProjection> findTopUsers(@Param("days") int days, @Param("limit") int limit);
}
