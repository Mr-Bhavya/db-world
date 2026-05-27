package com.db.dbworld.app.admin.analytics.service;

import com.db.dbworld.app.admin.analytics.dto.AnalyticsOverviewDto;
import com.db.dbworld.app.admin.analytics.dto.ClientBreakdownDto;
import com.db.dbworld.app.admin.analytics.dto.DailyActivityDto;
import com.db.dbworld.app.admin.analytics.dto.DailyActivityProjection;
import com.db.dbworld.app.admin.analytics.dto.TopRecordDto;
import com.db.dbworld.app.admin.analytics.dto.TopRecordProjection;
import com.db.dbworld.app.admin.analytics.dto.TopUserDto;
import com.db.dbworld.app.admin.analytics.dto.TopUserProjection;
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
public class AdminAnalyticsService {

    private static final BigDecimal BYTES_PER_GB = BigDecimal.valueOf(1024L * 1024L * 1024L);
    private static final BigDecimal HUNDRED      = BigDecimal.valueOf(100L);
    private static final int OVERVIEW_WINDOW_DAYS = 7;

    private final UserCinemaActivityRepository activityRepository;

    public AnalyticsOverviewDto getOverview() {
        long activeUsers = activityRepository.countActiveUsersSince(OVERVIEW_WINDOW_DAYS);
        long bytes       = activityRepository.sumBytesTransferredSince(OVERVIEW_WINDOW_DAYS);
        long completed   = activityRepository.countCompletedTransfersSince(OVERVIEW_WINDOW_DAYS);
        long aborted     = activityRepository.countAbortedSince(OVERVIEW_WINDOW_DAYS);

        BigDecimal gb = BigDecimal.valueOf(bytes).divide(BYTES_PER_GB, 2, RoundingMode.HALF_UP);

        long sessions = completed + aborted;
        BigDecimal abortedRate = sessions == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(aborted)
                        .multiply(HUNDRED)
                        .divide(BigDecimal.valueOf(sessions), 2, RoundingMode.HALF_UP);

        return new AnalyticsOverviewDto(activeUsers, gb, completed, abortedRate);
    }

    public List<DailyActivityDto> getDailyTrend(int days) {
        int safeDays = Math.max(1, Math.min(days, 365));
        return activityRepository.findDailyActivityTrend(safeDays).stream()
                .map(this::toDailyDto)
                .toList();
    }

    public List<ClientBreakdownDto> getClientBreakdown() {
        return activityRepository.findClientBreakdown().stream()
                .map(p -> new ClientBreakdownDto(p.getClientType(), p.getCount()))
                .toList();
    }

    public List<TopRecordDto> getTopRecords(int limit) {
        return activityRepository.findTopRecords(safeLimit(limit)).stream()
                .map(this::toTopRecordDto)
                .toList();
    }

    public List<TopUserDto> getTopUsers(int limit) {
        return activityRepository.findTopUsers(safeLimit(limit)).stream()
                .map(this::toTopUserDto)
                .toList();
    }

    private int safeLimit(int limit) {
        return Math.max(1, Math.min(limit, 100));
    }

    private DailyActivityDto toDailyDto(DailyActivityProjection p) {
        BigDecimal gb = BigDecimal.valueOf(p.getBytesTransferred())
                .divide(BYTES_PER_GB, 3, RoundingMode.HALF_UP);
        return new DailyActivityDto(p.getDate().toLocalDate(), p.getStreams(), p.getDownloads(), gb);
    }

    private TopRecordDto toTopRecordDto(TopRecordProjection p) {
        return new TopRecordDto(
                p.getRecordId(),
                p.getTitle(),
                p.getRecordType(),
                p.getStreamCount(),
                p.getDownloadCount(),
                p.getUniqueUsers()
        );
    }

    private TopUserDto toTopUserDto(TopUserProjection p) {
        BigDecimal gb = BigDecimal.valueOf(p.getTotalBytes())
                .divide(BYTES_PER_GB, 3, RoundingMode.HALF_UP);
        return new TopUserDto(
                p.getUserId(),
                p.getEmail(),
                p.getLastActive(),
                p.getTotalActivities(),
                gb
        );
    }
}
