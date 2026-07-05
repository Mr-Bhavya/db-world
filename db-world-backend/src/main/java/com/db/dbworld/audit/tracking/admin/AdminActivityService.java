package com.db.dbworld.audit.tracking.admin;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.audit.tracking.admin.dto.ActivityOverviewDto;
import com.db.dbworld.audit.tracking.admin.dto.ActivityUserDto;
import com.db.dbworld.audit.tracking.admin.dto.ClientBreakdownDto;
import com.db.dbworld.audit.tracking.admin.dto.LiveSessionDto;
import com.db.dbworld.audit.tracking.admin.dto.OverviewProjection;
import com.db.dbworld.audit.tracking.admin.dto.SessionEventDto;
import com.db.dbworld.audit.tracking.admin.dto.SessionRowDto;
import com.db.dbworld.audit.tracking.admin.dto.TopContentDto;
import com.db.dbworld.audit.tracking.admin.dto.TopUserDto;
import com.db.dbworld.audit.tracking.admin.dto.TrendDto;
import com.db.dbworld.audit.tracking.entity.ActivitySessionEntity;
import com.db.dbworld.audit.tracking.enums.ActivityKind;
import com.db.dbworld.audit.tracking.enums.SessionState;
import com.db.dbworld.audit.tracking.enums.TrackChannel;
import com.db.dbworld.audit.tracking.repository.ActivityEventRepository;
import com.db.dbworld.audit.tracking.repository.ActivitySessionRepository;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Read-side service backing the admin Activity console. Wraps
 * {@link ActivitySessionRepository} / {@link ActivityEventRepository} native
 * aggregate + Specification queries and transforms Spring Data projections
 * into immutable record DTOs — modeled on {@code AdminAnalyticsService}.
 */
@Log4j2
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminActivityService {

    private static final BigDecimal BYTES_PER_GB = BigDecimal.valueOf(1024L * 1024L * 1024L);
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100L);

    /** "Active now" heartbeat window — sessions with no event in this long are considered stale, not live. */
    private static final int LIVE_HEARTBEAT_MINUTES = 5;

    /**
     * Convention: a {@code days} param {@code <= 0} means "all time". Rather than
     * branching the native {@code INTERVAL :days DAY} queries into a windowed and an
     * unwindowed variant, "all time" is modeled as a very large window (~100 years) —
     * comfortably longer than any real {@code activity_session} history — so every
     * existing query keeps its single {@code WHERE last_event_at >= (NOW() - INTERVAL
     * :days DAY)} shape.
     */
    private static final int EFFECTIVE_ALL_TIME_DAYS = 36_500;

    /** Sane upper bound for an explicit positive {@code days} window (10 years). */
    private static final int MAX_DAYS = 3650;

    /**
     * The daily trend endpoint groups by {@code DATE(last_event_at)}, so an all-time
     * request could otherwise return one row per day of the site's entire history.
     * Capped separately (and more tightly) at ~1 year so the trend chart payload stays
     * bounded; the other aggregates (overview/client-breakdown/top-content/top-users)
     * are single-row or LIMIT-bounded already and don't need this extra cap.
     */
    private static final int MAX_TREND_DAYS = 365;

    private final ActivitySessionRepository activitySessionRepository;
    private final ActivityEventRepository activityEventRepository;
    private final UserRepository userRepository;
    private final RecordRepository recordRepository;

    public ActivityOverviewDto getOverview(int days) {
        int safeDays = safeDays(days);
        log.debug("getOverview days={} (clamped={})", days, safeDays);

        OverviewProjection p = activitySessionRepository.findOverview(safeDays);
        long liveCutoffMinutes = LIVE_HEARTBEAT_MINUTES;
        long activeNow = activitySessionRepository.countLiveSessions(
                Instant.now().minus(liveCutoffMinutes, ChronoUnit.MINUTES));

        long downloads = nz(p.getDownloadsToday());
        long streams = nz(p.getStreamsToday());
        long uniqueUsers = nz(p.getUniqueUsers());
        long uniqueBytes = nz(p.getUniqueBytes());
        long avgSpeedBps = nz(p.getAvgSpeedBps());
        long completed = nz(p.getCompletedCount());
        long total = nz(p.getTotalCount());

        BigDecimal gb = BigDecimal.valueOf(uniqueBytes).divide(BYTES_PER_GB, 2, RoundingMode.HALF_UP);
        BigDecimal completionRate = total == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(completed)
                        .multiply(HUNDRED)
                        .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);

        return new ActivityOverviewDto(activeNow, downloads, streams, uniqueUsers, gb, avgSpeedBps, completionRate);
    }

    public List<LiveSessionDto> getLiveSessions(int withinMinutes) {
        int safeMinutes = Math.max(1, Math.min(withinMinutes, 24 * 60));
        log.debug("getLiveSessions withinMinutes={} (clamped={})", withinMinutes, safeMinutes);
        Instant cutoff = Instant.now().minus(safeMinutes, ChronoUnit.MINUTES);
        return activitySessionRepository.findLiveSessions(cutoff).stream()
                .map(p -> new LiveSessionDto(
                        p.getSessionId(),
                        p.getUserEmail(),
                        p.getTitle(),
                        p.getActivity(),
                        p.getChannel(),
                        p.getClientApp(),
                        p.getState(),
                        p.getCompletionPercent(),
                        watchedPercent(p.getActivity(), p.getWatchPositionMs(), p.getWatchDurationMs()),
                        p.getWatchPositionMs(),
                        p.getWatchDurationMs(),
                        p.getAvgSpeedBps(),
                        p.getMaxSpeedBps(),
                        p.getPeakConnections(),
                        p.getUniqueBytes(),
                        p.getFileSize(),
                        p.getStartedAt(),
                        p.getLastEventAt()
                ))
                .toList();
    }

    /**
     * Paginated/filterable sessions table. userEmail/recordName are resolved via a
     * batch lookup after the page is fetched (rather than a native projection
     * variant) because {@code ActivitySessionRepository#search} must stay on
     * {@link JpaSpecificationExecutor} for dynamic filter composition — mixing that
     * with a native JOIN projection isn't supported by Spring Data. The page size
     * is admin-console scale (tens of rows), so N+1 avoidance via two extra
     * findAllById batch calls is cheap and keeps the filter code simple.
     */
    public Page<SessionRowDto> searchSessions(
            Long userId, ActivityKind activity, TrackChannel channel, String clientApp,
            SessionState state, Long recordId, Instant from, Instant to,
            Pageable pageable) {

        Page<ActivitySessionEntity> page = activitySessionRepository.search(
                userId, activity, channel, clientApp, state, recordId, from, to, pageable);

        List<Long> userIds = page.getContent().stream()
                .map(ActivitySessionEntity::getUserId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        List<Long> recordIds = page.getContent().stream()
                .map(ActivitySessionEntity::getRecordId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();

        Map<Long, String> emailsById = userIds.isEmpty()
                ? Map.of()
                : userRepository.findAllById(userIds).stream()
                        .collect(Collectors.toMap(UserEntity::getUserId, UserEntity::getEmail));
        Map<Long, String> namesById = recordIds.isEmpty()
                ? Map.of()
                : recordRepository.findAllById(recordIds).stream()
                        .collect(Collectors.toMap(RecordEntity::getId, RecordEntity::getName));

        return page.map(e -> toSessionRowDto(e, emailsById, namesById));
    }

    public List<SessionEventDto> getSessionEvents(String sessionId) {
        log.debug("getSessionEvents sessionId={}", sessionId);
        return activityEventRepository.findEventsBySessionIdOrderByEventTime(sessionId).stream()
                .map(p -> new SessionEventDto(
                        p.getId(),
                        p.getEventTime(),
                        p.getEventType(),
                        p.getSource(),
                        p.getBytesDelta(),
                        p.getCumulativeBytes(),
                        p.getSpeedBps(),
                        p.getConnections(),
                        p.getPositionMs(),
                        p.getCompletionPercent(),
                        p.getErrorCode(),
                        p.getErrorMessage()
                ))
                .toList();
    }

    public List<TrendDto> getTrend(int days) {
        int safeDays = safeTrendDays(days);
        log.debug("getTrend days={} (clamped={})", days, safeDays);
        return activitySessionRepository.findTrend(safeDays).stream()
                .map(p -> new TrendDto(
                        p.getDate(),
                        nz(p.getStreams()),
                        nz(p.getDownloads()),
                        BigDecimal.valueOf(nz(p.getUniqueBytes())).divide(BYTES_PER_GB, 3, RoundingMode.HALF_UP)
                ))
                .toList();
    }

    public List<ClientBreakdownDto> getClientBreakdown(int days) {
        int safeDays = safeDays(days);
        log.debug("getClientBreakdown days={} (clamped={})", days, safeDays);
        return activitySessionRepository.findClientBreakdown(safeDays).stream()
                .map(p -> new ClientBreakdownDto(p.getClientApp(), nz(p.getCount())))
                .toList();
    }

    public List<TopContentDto> getTopContent(int days, int limit) {
        int safeDays = safeDays(days);
        int safeLimit = safeLimit(limit);
        log.debug("getTopContent days={} limit={}", safeDays, safeLimit);
        return activitySessionRepository.findTopContent(safeDays, safeLimit).stream()
                .map(p -> new TopContentDto(
                        p.getRecordId(),
                        p.getTitle(),
                        p.getRecordType(),
                        nz(p.getStreamCount()),
                        nz(p.getDownloadCount()),
                        nz(p.getUniqueUsers())
                ))
                .toList();
    }

    public List<TopUserDto> getTopUsers(int days, int limit) {
        int safeDays = safeDays(days);
        int safeLimit = safeLimit(limit);
        log.debug("getTopUsers days={} limit={}", safeDays, safeLimit);
        return activitySessionRepository.findTopUsers(safeDays, safeLimit).stream()
                .map(p -> new TopUserDto(
                        p.getUserId(),
                        p.getEmail(),
                        p.getLastActive(),
                        nz(p.getTotalSessions()),
                        BigDecimal.valueOf(nz(p.getTotalBytes())).divide(BYTES_PER_GB, 3, RoundingMode.HALF_UP)
                ))
                .toList();
    }

    /**
     * Distinct users who have at least one {@code activity_session} row — feeds the
     * user-filter dropdown on the admin Activity console (as opposed to the full
     * {@code users} table, which would include users with zero tracked activity).
     */
    public List<ActivityUserDto> getActivityUsers() {
        log.debug("getActivityUsers");
        return activitySessionRepository.findDistinctActivityUsers().stream()
                .map(p -> new ActivityUserDto(
                        p.getUserId(),
                        p.getEmail(),
                        p.getFirstName(),
                        p.getLastName()
                ))
                .toList();
    }

    private SessionRowDto toSessionRowDto(
            ActivitySessionEntity e, Map<Long, String> emailsById, Map<Long, String> namesById) {
        return new SessionRowDto(
                e.getSessionId(),
                e.getUserId(),
                e.getUserId() != null ? emailsById.get(e.getUserId()) : null,
                e.getRecordId(),
                e.getRecordId() != null ? namesById.get(e.getRecordId()) : null,
                e.getSeasonNumber(),
                e.getEpisodeNumber(),
                e.getFileName(),
                e.getActivity() != null ? e.getActivity().name() : null,
                e.getChannel() != null ? e.getChannel().name() : null,
                e.getClientApp(),
                e.getState() != null ? e.getState().name() : null,
                e.getCompletionPercent(),
                watchedPercent(e.getActivity(), e.getWatchPositionMs(), e.getWatchDurationMs()),
                e.getWatchPositionMs(),
                e.getWatchDurationMs(),
                e.getUniqueBytes(),
                e.getFileSize(),
                e.getAvgSpeedBps(),
                e.getMaxSpeedBps(),
                e.getPeakConnections(),
                e.getStartedAt(),
                e.getLastEventAt(),
                e.getCompletedAt(),
                e.getLastErrorCode(),
                e.getLastErrorMessage(),
                e.getAttemptCount(),
                e.getPauseCount(),
                e.getResumeCount(),
                e.getFailCount(),
                e.getNginxTransferredBytes()
        );
    }

    private static long nz(Long value) {
        return value != null ? value : 0L;
    }

    /**
     * "Watched %" for STREAM sessions — how far the viewer got, derived from the furthest
     * reported {@code watchPositionMs} over the reported {@code watchDurationMs} (both fed by
     * {@code SessionAggregator#applyClientEvent} from STREAM_START/STREAM_TICK/SEEK/STREAM_PAUSE
     * event positionMs/durationMs). This is deliberately separate from the byte-based
     * {@code completionPercent}: a STREAM session's {@code state} goes to COMPLETED as soon as
     * the player reports STREAM_STOP (a clean end of the viewing session), which says nothing
     * about how much of the title was actually watched — {@code watchedPercent} is that signal.
     * Downloads have no watch position, so this is null for them (the UI falls back to the byte
     * {@code completionPercent} there).
     */
    private static BigDecimal watchedPercent(String activity, Long watchPositionMs, Long watchDurationMs) {
        return watchedPercent(ActivityKind.STREAM.name().equals(activity), watchPositionMs, watchDurationMs);
    }

    private static BigDecimal watchedPercent(ActivityKind activity, Long watchPositionMs, Long watchDurationMs) {
        return watchedPercent(activity == ActivityKind.STREAM, watchPositionMs, watchDurationMs);
    }

    private static BigDecimal watchedPercent(boolean isStream, Long watchPositionMs, Long watchDurationMs) {
        if (!isStream || watchDurationMs == null || watchDurationMs <= 0 || watchPositionMs == null) {
            return null;
        }
        BigDecimal pct = BigDecimal.valueOf(watchPositionMs)
                .multiply(HUNDRED)
                .divide(BigDecimal.valueOf(watchDurationMs), 2, RoundingMode.HALF_UP);
        return pct.min(HUNDRED);
    }

    /**
     * Clamps a caller-supplied {@code days} window. {@code days <= 0} means "all time"
     * (see {@link #EFFECTIVE_ALL_TIME_DAYS}); positive values are capped at
     * {@link #MAX_DAYS} so a client can't request an unreasonably large native-query window.
     */
    private static int safeDays(int days) {
        return days <= 0 ? EFFECTIVE_ALL_TIME_DAYS : Math.min(days, MAX_DAYS);
    }

    /** Same "all time" convention as {@link #safeDays}, but capped at {@link #MAX_TREND_DAYS} for the daily trend. */
    private static int safeTrendDays(int days) {
        return days <= 0 ? MAX_TREND_DAYS : Math.min(days, MAX_TREND_DAYS);
    }

    private static int safeLimit(int limit) {
        return Math.max(1, Math.min(limit, 100));
    }
}
