package com.db.dbworld.app.admin.scheduler.service;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.admin.scheduler.dto.JobRunSummary;
import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobConfigEntity;
import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobConfigEntity.JobType;
import com.db.dbworld.app.admin.scheduler.repository.SchedulerJobConfigRepository;
import com.db.dbworld.app.admin.scheduler.repository.SchedulerJobHistoryRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SchedulerHistoryRetentionServiceTest {

    @Mock SchedulerJobHistoryRepository historyRepo;
    @Mock SchedulerJobConfigRepository  configRepo;
    @Mock SettingsService               settings;
    @InjectMocks SchedulerHistoryRetentionService service;

    @BeforeEach
    void defaults() {
        when(settings.getInt(ConfigKeys.SCHEDULER_HISTORY_RETENTION_DAYS)).thenReturn(30);
        when(settings.getInt(ConfigKeys.SCHEDULER_HISTORY_RETENTION_DAYS_FREQUENT)).thenReturn(3);
        when(historyRepo.findIdsToPrune(any(), any(), any())).thenReturn(List.of());
    }

    private static SchedulerJobConfigEntity cron(String id) {
        return SchedulerJobConfigEntity.builder().jobId(id)
                .jobType(JobType.CRON).cronExpression("0 0 2 * * *").build();
    }

    private static SchedulerJobConfigEntity fixedDelay(String id, int seconds) {
        return SchedulerJobConfigEntity.builder().jobId(id)
                .jobType(JobType.FIXED_DELAY).intervalSeconds(seconds).build();
    }

    private LocalDateTime cutoffFor(String jobName) {
        ArgumentCaptor<LocalDateTime> cutoff = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(historyRepo).findIdsToPrune(eq(jobName), cutoff.capture(), any(Pageable.class));
        return cutoff.getValue();
    }

    /** Days between a captured cutoff and now, rounded — guards against off-by-one on the clock. */
    private static long daysAgo(LocalDateTime cutoff) {
        return Math.round(java.time.Duration.between(cutoff, LocalDateTime.now()).toHours() / 24.0);
    }

    @Test
    void fixedDelayJobs_getTheShortRetention() {
        when(historyRepo.findDistinctJobNames()).thenReturn(List.of("MediaSync"));
        when(configRepo.findById("MediaSync")).thenReturn(Optional.of(fixedDelay("MediaSync", 60)));

        service.prune(JobRunSummary.builder());

        assertThat(daysAgo(cutoffFor("MediaSync"))).isEqualTo(3);
    }

    @Test
    void dailyCronJobs_getTheStandardRetention() {
        when(historyRepo.findDistinctJobNames()).thenReturn(List.of("TmdbMovieSync"));
        when(configRepo.findById("TmdbMovieSync")).thenReturn(Optional.of(cron("TmdbMovieSync")));

        service.prune(JobRunSummary.builder());

        assertThat(daysAgo(cutoffFor("TmdbMovieSync"))).isEqualTo(30);
    }

    /**
     * "Frequent" is derived from cadence, not a hardcoded id — a future minutes-scale job is
     * covered the day it is added, and the half-hourly IPO refresh is not swept up with it.
     */
    @Test
    void shortIntervalJobs_countAsFrequent_butHalfHourlyOnesDoNot() {
        when(historyRepo.findDistinctJobNames()).thenReturn(List.of("FiveMinJob", "ipo-live"));
        when(configRepo.findById("FiveMinJob")).thenReturn(Optional.of(fixedDelay("FiveMinJob", 300)));
        when(configRepo.findById("ipo-live")).thenReturn(Optional.of(cron("ipo-live")));

        service.prune(JobRunSummary.builder());

        assertThat(daysAgo(cutoffFor("FiveMinJob"))).isEqualTo(3);
        assertThat(daysAgo(cutoffFor("ipo-live"))).isEqualTo(30);
    }

    /** A retired job keeps its history under the standard window rather than being dropped fast. */
    @Test
    void jobWithNoConfigRow_getsTheStandardRetention() {
        when(historyRepo.findDistinctJobNames()).thenReturn(List.of("ipo-notify"));
        when(configRepo.findById("ipo-notify")).thenReturn(Optional.empty());

        service.prune(JobRunSummary.builder());

        assertThat(daysAgo(cutoffFor("ipo-notify"))).isEqualTo(30);
    }

    @Test
    void deletesInBatchesUntilTheBacklogIsClear() {
        when(historyRepo.findDistinctJobNames()).thenReturn(List.of("MediaSync"));
        when(configRepo.findById("MediaSync")).thenReturn(Optional.of(fixedDelay("MediaSync", 60)));
        // Two full batches, then a partial one, then nothing left.
        when(historyRepo.findIdsToPrune(eq("MediaSync"), any(), any(Pageable.class)))
                .thenReturn(ids(500), ids(500), ids(120), List.of());

        JobRunSummary.Builder summary = JobRunSummary.builder();
        service.prune(summary);

        verify(historyRepo, org.mockito.Mockito.times(3)).deleteAllByIdInBatch(anyList());
        assertThat(summary.build().counters())
                .containsEntry("MediaSync", 1120L)
                .containsEntry("rowsDeleted", 1120L);
    }

    @Test
    void nothingToPrune_reportsZeroAndDeletesNothing() {
        when(historyRepo.findDistinctJobNames()).thenReturn(List.of("MediaSync"));
        when(configRepo.findById("MediaSync")).thenReturn(Optional.of(fixedDelay("MediaSync", 60)));

        JobRunSummary.Builder summary = JobRunSummary.builder();
        service.prune(summary);

        verify(historyRepo, never()).deleteAllByIdInBatch(anyList());
        JobRunSummary built = summary.build();
        assertThat(built.counters()).containsEntry("rowsDeleted", 0L);
        assertThat(built.note()).contains("Nothing to prune");
    }

    private static List<Long> ids(int n) {
        return java.util.stream.LongStream.range(0, n).boxed().toList();
    }
}
