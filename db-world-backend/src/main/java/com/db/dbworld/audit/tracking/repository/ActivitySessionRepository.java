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
import com.db.dbworld.audit.tracking.me.dto.MeSummaryProjection;
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

// NOTE: methods below in the "RECOMMENDATION SIGNALS" section are the
// activity_session-backed replacements for the old
// UserCinemaActivityRepository#findTopEngagedGenreIdsByUser /
// #countEngagedRecordsByUser / #findTopRewatchedRecordIds /
// #findMostRecentRecordIdsByUser. See class-level Javadoc on each method for
// how the semantics were adapted to the one-row-per-session model.

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
     * Live sessions table: currently RESOLVING/ACTIVE/PAUSED sessions with a recent
     * heartbeat, enriched with user email and record title/type via LEFT JOIN (both
     * may be absent for orphaned rows). RESOLVING is included so a resolved-but-not-
     * yet-transferring session (e.g. a queued external download) still shows as live.
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
            WHERE s.state IN ('RESOLVING', 'ACTIVE', 'PAUSED')
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

    /**
     * Header-stats aggregate for the personal {@code /me/activity} page, over all of the
     * caller's own sessions (no time window — modeled on {@link #findOverview} but scoped
     * by {@code user_id} instead of a trailing-days cutoff).
     */
    @Query(value = """
            SELECT
                SUM(CASE WHEN activity = 'STREAM'   THEN 1 ELSE 0 END)              AS streamCount,
                SUM(CASE WHEN activity = 'DOWNLOAD' THEN 1 ELSE 0 END)              AS downloadCount,
                COUNT(DISTINCT CASE WHEN activity IN ('STREAM', 'DOWNLOAD') THEN record_id END) AS distinctTitles,
                COALESCE(SUM(unique_bytes), 0)                                      AS uniqueBytes,
                COALESCE(SUM(CASE WHEN activity = 'STREAM' THEN watch_duration_ms ELSE 0 END), 0) AS watchDurationMs,
                SUM(CASE WHEN state = 'COMPLETED' THEN 1 ELSE 0 END)                AS completedCount,
                COUNT(*)                                                            AS totalCount
            FROM activity_session
            WHERE user_id = :userId
              AND activity IN ('DOWNLOAD', 'STREAM')
            """, nativeQuery = true)
    MeSummaryProjection findMeSummary(@Param("userId") Long userId);

    /* =========================================================================
       RECOMMENDATION SIGNALS — activity_session replacements for the old
       UserCinemaActivityRepository "PHASE 5" queries. Old system stays intact
       (not yet deleted); these are the new home for the rail/recommend path.
       ========================================================================= */

    /**
     * Top genres for a user by count of distinct engaged records, replicating
     * {@code UserCinemaActivityRepository#findTopEngagedGenreIdsByUser}. A session is
     * "engaged" when {@code state = 'COMPLETED'} or {@code completion_percent >= :completionThreshold},
     * restricted to STREAM activity (the old query's {@code download_count >= 1} branch has no
     * one-row-per-session equivalent here — a completed DOWNLOAD session already satisfies
     * {@code state = 'COMPLETED'} above, so DOWNLOAD engagement is still captured without a
     * separate branch). Joins records → tmdb_genres → genres, same path as the old query.
     */
    @Query(value = """
            SELECT g.id AS genreId
            FROM activity_session s
            JOIN records r        ON r.id = s.record_id
            JOIN tmdb_genres tg   ON tg.tmdb_id = r.tmdb_id
            JOIN genres g         ON g.id = tg.genre_id
            WHERE s.user_id = :userId
              AND s.record_id IS NOT NULL
              AND s.activity = 'STREAM'
              AND (s.state = 'COMPLETED' OR s.completion_percent >= :completionThreshold)
            GROUP BY g.id
            ORDER BY COUNT(DISTINCT s.record_id) DESC, MAX(s.last_event_at) DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Long> findTopEngagedGenreIdsByUser(
            @Param("userId")              Long userId,
            @Param("completionThreshold") int completionThreshold,
            @Param("limit")               int limit
    );

    /**
     * Count of distinct engaged records for a user — the cold-start guard for
     * {@link #findTopEngagedGenreIdsByUser}, replacing
     * {@code UserCinemaActivityRepository#countEngagedRecordsByUser}. Same engagement
     * definition as above (STREAM sessions that are COMPLETED or past the completion threshold).
     */
    @Query(value = """
            SELECT COUNT(DISTINCT record_id)
            FROM activity_session
            WHERE user_id = :userId
              AND record_id IS NOT NULL
              AND activity = 'STREAM'
              AND (state = 'COMPLETED' OR completion_percent >= :completionThreshold)
            """, nativeQuery = true)
    long countEngagedRecordsByUser(
            @Param("userId")              Long userId,
            @Param("completionThreshold") int completionThreshold
    );

    /**
     * Site-wide top-rewatched record IDs in the last {@code :windowDays} days, replacing
     * {@code UserCinemaActivityRepository#findTopRewatchedRecordIds}.
     *
     * <p><b>Ranking-choice note:</b> the old table was one-row-per-(user,file,activityType)
     * with lifetime {@code download_count}/{@code stream_count} counters, so "rewatch score"
     * was simply {@code SUM(download_count + stream_count)} per record. The new schema is
     * one-row-per-session, so a "rewatch" is a user starting more than one STREAM session for
     * the same record. We rank records by total repeat-session volume:
     * {@code COUNT(*) - COUNT(DISTINCT user_id)} per record — i.e. every session beyond a
     * user's first counts as one rewatch. This is the closest one-pass equivalent of the old
     * cumulative counter and naturally yields 0 for records nobody has rewatched, so the
     * {@code HAVING ... >= :minScore} filter still behaves the same way (minScore=0 lets all
     * engaged records through; minScore>=1 requires at least one actual repeat session).
     */
    @Query(value = """
            SELECT record_id
            FROM activity_session
            WHERE last_event_at >= (NOW() - INTERVAL :windowDays DAY)
              AND activity = 'STREAM'
              AND record_id IS NOT NULL
            GROUP BY record_id
            HAVING (COUNT(*) - COUNT(DISTINCT user_id)) >= :minScore
            ORDER BY (COUNT(*) - COUNT(DISTINCT user_id)) DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Long> findTopRewatchedRecordIds(
            @Param("windowDays") int windowDays,
            @Param("minScore")   int minScore,
            @Param("limit")      int limit
    );

    /**
     * A user's most recent distinct record IDs from STREAM sessions, ordered by recency,
     * replacing {@code UserCinemaActivityRepository#findMostRecentRecordIdsByUser}. JPQL
     * (not native) so Spring Data applies {@code LIMIT}/{@code OFFSET} from the {@link Pageable}
     * automatically, matching the old method's signature exactly (every call site passes
     * {@code PageRequest.of(0, 1)} and only ever reads the first element, so — same as the old
     * query — this intentionally does not de-duplicate record IDs across sessions).
     *
     * <p>Scoped to STREAM only: the old query covered both STREAM and DOWNLOAD, but "most
     * recently watched" (used to seed the becauseYouWatched rail / dynamic title) is a playback
     * signal — DOWNLOAD-only engagement is already covered by
     * {@code WatchProgressRepository#findMostRecentRecordIdsByUser}, which every caller of this
     * method tries first, falling back here only when that is empty.
     */
    @Query("""
            SELECT a.recordId FROM ActivitySessionEntity a
            WHERE a.userId = :userId
              AND a.recordId IS NOT NULL
              AND a.activity = com.db.dbworld.audit.tracking.enums.ActivityKind.STREAM
            ORDER BY a.lastEventAt DESC
            """)
    List<Long> findMostRecentRecordIdsByUser(@Param("userId") Long userId, Pageable pageable);
}
