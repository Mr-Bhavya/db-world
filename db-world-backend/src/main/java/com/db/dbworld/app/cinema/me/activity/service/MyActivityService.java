package com.db.dbworld.app.cinema.me.activity.service;

import com.db.dbworld.app.cinema.me.activity.dto.MyActivitySummaryDto;
import com.db.dbworld.app.cinema.me.activity.dto.TopRewatchDto;
import com.db.dbworld.app.cinema.me.activity.dto.TopRewatchProjection;
import com.db.dbworld.audit.activity.dto.UserActivityProjection;
import com.db.dbworld.audit.activity.dto.UserActivityViewDto;
import com.db.dbworld.audit.activity.repository.UserCinemaActivityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MyActivityService {

    private static final BigDecimal MS_PER_HOUR = BigDecimal.valueOf(3_600_000L);
    private static final BigDecimal BYTES_PER_GB = BigDecimal.valueOf(1024L * 1024L * 1024L);
    private static final BigDecimal HUNDRED      = BigDecimal.valueOf(100L);

    private final UserCinemaActivityRepository activityRepository;

    public MyActivitySummaryDto getSummary(Long userId) {
        long streamMs       = activityRepository.sumStreamDurationMsByUser(userId);
        long downloadBytes  = activityRepository.sumCompletedDownloadBytesByUser(userId);
        long completedCount = activityRepository.countCompletedTransferSessions(userId);
        long totalCount     = activityRepository.countTotalTransferSessions(userId);

        BigDecimal hours      = BigDecimal.valueOf(streamMs).divide(MS_PER_HOUR, 2, RoundingMode.HALF_UP);
        BigDecimal gb         = BigDecimal.valueOf(downloadBytes).divide(BYTES_PER_GB, 2, RoundingMode.HALF_UP);
        BigDecimal completion = totalCount == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(completedCount)
                        .multiply(HUNDRED)
                        .divide(BigDecimal.valueOf(totalCount), 2, RoundingMode.HALF_UP);

        // topGenres deferred to Phase 5 (recommendations module owns genre signals).
        return new MyActivitySummaryDto(hours, gb, completion, List.of());
    }

    public List<TopRewatchDto> getTopRewatches(Long userId, int limit) {
        return activityRepository.findTopRewatchesByUser(userId, limit).stream()
                .map(this::toRewatchDto)
                .toList();
    }

    public List<UserActivityViewDto> getActivities(Long userId, String activityType, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        return activityRepository
                .findUserActivityView(userId, activityType, safeSize, safePage * safeSize)
                .stream()
                .map(UserActivityViewDto::from)
                .toList();
    }

    private TopRewatchDto toRewatchDto(TopRewatchProjection p) {
        return new TopRewatchDto(
                p.getRecordId(),
                p.getTitle(),
                p.getRecordType(),
                p.getDownloadCount(),
                p.getStreamCount(),
                p.getTotalCount(),
                p.getLastCompletedAt()
        );
    }
}
