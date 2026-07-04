package com.db.dbworld.audit.tracking.me;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.audit.tracking.entity.ActivitySessionEntity;
import com.db.dbworld.audit.tracking.enums.ActivityKind;
import com.db.dbworld.audit.tracking.me.dto.MeActivitySummaryDto;
import com.db.dbworld.audit.tracking.me.dto.MeSessionDto;
import com.db.dbworld.audit.tracking.me.dto.MeSummaryProjection;
import com.db.dbworld.audit.tracking.repository.ActivitySessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Read-side service backing the personal {@code /me/activity} page. Wraps
 * {@link ActivitySessionRepository}'s native aggregate + the shared
 * {@code search(...)} Specification query, scoped to the calling user only —
 * modeled on {@code AdminActivityService}, but with no cross-user access.
 */
@Log4j2
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MeActivityService {

    /** Decimal GB (bytes / 1e9) per the task brief — NOT the binary GiB (1024^3) used by the admin console. */
    private static final BigDecimal BYTES_PER_GB = BigDecimal.valueOf(1_000_000_000L);
    private static final BigDecimal MS_PER_HOUR = BigDecimal.valueOf(3_600_000L);
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100L);

    private final ActivitySessionRepository activitySessionRepository;
    private final RecordRepository recordRepository;

    public MeActivitySummaryDto getSummary(Long userId) {
        log.debug("getSummary: userId={}", userId);
        MeSummaryProjection p = activitySessionRepository.findMeSummary(userId);

        long streamCount = nz(p.getStreamCount());
        long downloadCount = nz(p.getDownloadCount());
        long distinctTitles = nz(p.getDistinctTitles());
        long uniqueBytes = nz(p.getUniqueBytes());
        long watchDurationMs = nz(p.getWatchDurationMs());
        long completedCount = nz(p.getCompletedCount());
        long totalCount = nz(p.getTotalCount());

        BigDecimal gbDelivered = BigDecimal.valueOf(uniqueBytes).divide(BYTES_PER_GB, 2, RoundingMode.HALF_UP);
        BigDecimal watchHours = BigDecimal.valueOf(watchDurationMs).divide(MS_PER_HOUR, 2, RoundingMode.HALF_UP);
        BigDecimal completionRate = totalCount == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(completedCount)
                        .multiply(HUNDRED)
                        .divide(BigDecimal.valueOf(totalCount), 2, RoundingMode.HALF_UP);

        return new MeActivitySummaryDto(streamCount, downloadCount, distinctTitles, gbDelivered, watchHours, completionRate);
    }

    /**
     * Paginated personal timeline, newest first, optionally filtered by activity kind.
     * {@code userId} is always fixed to the caller — every other filter accepted by
     * {@code search()} (channel/clientApp/state/recordId/date-range) is left null since
     * the personal timeline exposes no such filters yet.
     */
    public Page<MeSessionDto> getTimeline(Long userId, ActivityKind activity, Pageable pageable) {
        log.debug("getTimeline: userId={}, activity={}", userId, activity);

        Page<ActivitySessionEntity> page = activitySessionRepository.search(
                userId, activity, null, null, null, null, null, null, pageable);

        List<Long> recordIds = page.getContent().stream()
                .map(ActivitySessionEntity::getRecordId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, String> namesById = recordIds.isEmpty()
                ? Map.of()
                : recordRepository.findAllById(recordIds).stream()
                        .collect(Collectors.toMap(RecordEntity::getId, RecordEntity::getName));

        return page.map(e -> toSessionDto(e, namesById));
    }

    private MeSessionDto toSessionDto(ActivitySessionEntity e, Map<Long, String> namesById) {
        String title = e.getRecordId() != null ? namesById.get(e.getRecordId()) : null;
        return new MeSessionDto(
                e.getSessionId(),
                e.getActivity() != null ? e.getActivity().name() : null,
                e.getState() != null ? e.getState().name() : null,
                e.getRecordId(),
                title != null ? title : e.getFileName(),
                e.getFileName(),
                e.getCompletionPercent(),
                e.getUniqueBytes(),
                e.getFileSize(),
                e.getLastEventAt(),
                e.getStartedAt()
        );
    }

    private static long nz(Long value) {
        return value != null ? value : 0L;
    }
}
