package com.db.dbworld.app.admin.scheduler.service;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.admin.scheduler.dto.JobRunSummary;
import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobConfigEntity;
import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobConfigEntity.JobType;
import com.db.dbworld.app.admin.scheduler.repository.SchedulerJobConfigRepository;
import com.db.dbworld.app.admin.scheduler.repository.SchedulerJobHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Nightly prune of {@code scheduler_job_history}.
 *
 * <p>Nothing deleted these rows before, and MediaSync writes one every 60 seconds — in a
 * recent production dump 15,180 of 15,499 rows (98%) were MediaSync ticks, almost all of
 * them "nothing changed". Unbounded growth is bad on its own; it is worse now that each row
 * also carries a run summary and correlation id.
 *
 * <p>High-frequency jobs get their own, much shorter retention. "High-frequency" is derived
 * from the job's configured cadence rather than a hardcoded job id, so a future minutes-scale
 * job is covered the day it is added.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class SchedulerHistoryRetentionService {

    /** Job id under which this prune appears on the admin Scheduler page. */
    public static final String JOB_ID = "SchedulerHistoryPrune";

    /**
     * A job whose interval is at or below this is treated as high-frequency and pruned on the
     * shorter retention. 15 minutes sits comfortably above the IPO live refresh (30 min, worth
     * keeping a month of) and below MediaSync (60s).
     */
    private static final int FREQUENT_INTERVAL_SECONDS = 900;

    /** Rows deleted per transaction — small enough to keep table locks short on the Pi. */
    private static final int BATCH_SIZE = 500;

    /** Hard stop so a misconfigured cutoff can't spin here all night. */
    private static final int MAX_BATCHES_PER_JOB = 200;

    private final SchedulerJobHistoryRepository historyRepo;
    private final SchedulerJobConfigRepository  configRepo;
    private final SettingsService               settings;

    /** Prunes every job's history, reporting per-job deletions into {@code summary}. */
    public void prune(JobRunSummary.Builder summary) {
        int standardDays = settings.getInt(ConfigKeys.SCHEDULER_HISTORY_RETENTION_DAYS);
        int frequentDays = settings.getInt(ConfigKeys.SCHEDULER_HISTORY_RETENTION_DAYS_FREQUENT);
        LocalDateTime now = LocalDateTime.now();

        long totalDeleted = 0;
        int jobsTouched = 0;

        for (String jobName : historyRepo.findDistinctJobNames()) {
            int days = isFrequent(jobName) ? frequentDays : standardDays;
            long deleted = pruneJob(jobName, now.minusDays(days));
            if (deleted > 0) {
                summary.count(jobName, deleted);
                totalDeleted += deleted;
                jobsTouched++;
                log.info("Pruned {} history rows for {} (retention {}d)", deleted, jobName, days);
            }
        }

        summary.count("rowsDeleted", totalDeleted)
               .note(totalDeleted == 0
                       ? "Nothing to prune — all history is within retention"
                       : "Deleted " + totalDeleted + " row(s) across " + jobsTouched + " job(s)");
    }

    /**
     * A job counts as high-frequency when it self-schedules on a fixed delay, or when its
     * configured interval is at or below {@link #FREQUENT_INTERVAL_SECONDS}. A job with no
     * config row left (retired, history retained) falls back to standard retention.
     */
    private boolean isFrequent(String jobName) {
        return configRepo.findById(jobName)
                .map(c -> c.getJobType() == JobType.FIXED_DELAY || isShortInterval(c))
                .orElse(false);
    }

    private boolean isShortInterval(SchedulerJobConfigEntity c) {
        return c.getIntervalSeconds() != null && c.getIntervalSeconds() <= FREQUENT_INTERVAL_SECONDS;
    }

    private long pruneJob(String jobName, LocalDateTime cutoff) {
        long deleted = 0;
        for (int batch = 0; batch < MAX_BATCHES_PER_JOB; batch++) {
            int n = deleteBatch(jobName, cutoff);
            if (n == 0) break;
            deleted += n;
        }
        return deleted;
    }

    /**
     * Deletes one batch. Deliberately <em>not</em> annotated {@code @Transactional}: this is
     * called from {@link #pruneJob} inside the same bean, where self-invocation bypasses the
     * proxy and the annotation would do nothing. Spring Data's {@code deleteAllByIdInBatch}
     * is already transactional on its own, which gives exactly the per-batch commit we want —
     * a long backlog clears incrementally and an interruption keeps what it already removed.
     */
    private int deleteBatch(String jobName, LocalDateTime cutoff) {
        List<Long> ids = historyRepo.findIdsToPrune(jobName, cutoff, PageRequest.of(0, BATCH_SIZE));
        if (ids.isEmpty()) return 0;
        historyRepo.deleteAllByIdInBatch(ids);
        return ids.size();
    }
}
