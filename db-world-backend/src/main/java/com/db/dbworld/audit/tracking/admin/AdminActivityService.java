package com.db.dbworld.audit.tracking.admin;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.audit.tracking.admin.dto.ActivityOverviewDto;
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
        int safeDays = safeDays(days);
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

    private static int safeDays(int days) {
        return Math.max(1, Math.min(days, 365));
    }

    private static int safeLimit(int limit) {
        return Math.max(1, Math.min(limit, 100));
    }
}
