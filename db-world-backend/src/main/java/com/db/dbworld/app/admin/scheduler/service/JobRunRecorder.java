package com.db.dbworld.app.admin.scheduler.service;

import com.db.dbworld.app.admin.scheduler.dto.JobRunSummary;
import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobHistoryEntity;
import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobHistoryEntity.TriggerSource;
import com.db.dbworld.app.admin.scheduler.repository.SchedulerJobHistoryRepository;
import com.db.dbworld.infrastructure.logging.mdc.MdcKeys;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.apache.logging.log4j.ThreadContext;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Wraps one execution of a background job: mints its correlation id, publishes it to the
 * MDC so every log line the job emits carries it, times the run, and writes the
 * {@code scheduler_job_history} row.
 *
 * <p>This centralises three things that used to be copy-pasted (and drifting) across the
 * jobs:
 * <ul>
 *   <li><b>Correlation.</b> Every job already minted a private {@code traceId} and threw it
 *       away, so the log lines were tagged but unfindable. The id now lands on the history
 *       row, which is what makes "show me the logs for THIS run" possible.</li>
 *   <li><b>Outcome.</b> Jobs report what they did through the {@link JobRunSummary.Builder}
 *       handed to them, so a successful run records more than a duration. Counters set
 *       before a failure are kept — "failed after syncing 312 of 900" beats "FAILED".</li>
 *   <li><b>History writes.</b> There is now exactly one place that writes a history row.
 *       MediaSync previously wrote its own <em>and</em> got one from the admin trigger
 *       path, so every manual MediaSync run produced two rows.</li>
 * </ul>
 *
 * <p>MDC keys are saved and restored rather than cleared, so a job triggered from an HTTP
 * request doesn't blow away that request's {@code traceId}/{@code user} slots.
 */
@Log4j2
@Component
@RequiredArgsConstructor
public class JobRunRecorder {

    private final SchedulerJobHistoryRepository historyRepo;

    /**
     * Private mapper, not the injected bean: Spring Boot 4 ships Jackson 3 and exposes no
     * {@code com.fasterxml.jackson.databind.ObjectMapper} bean to inject (see
     * {@code JacksonBeanWiringTest}). Nothing here needs the app's customisations anyway —
     * this serialises a map of counters.
     */
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** The work of one job run. Report what happened by mutating {@code summary}. */
    @FunctionalInterface
    public interface RecordedJob<T> {
        T run(JobRunSummary.Builder summary) throws Exception;
    }

    /**
     * Runs {@code body} as a recorded job run and returns whatever it produced.
     *
     * <p>On failure the history row is written as {@code FAILED} (carrying any counters the
     * job managed to set) and the exception is rethrown — callers decide whether a failed
     * run should propagate. Cron dispatch swallows it; nothing else currently calls this.
     *
     * @param source who started the run
     * @param user   email of the triggering admin; null for {@link TriggerSource#SCHEDULED}
     */
    public <T> T run(String jobId, TriggerSource source, String user, RecordedJob<T> body) {
        String runId = newRunId();
        String prevJob   = ThreadContext.get(MdcKeys.JOB);
        String prevRunId = ThreadContext.get(MdcKeys.JOB_RUN_ID);
        ThreadContext.put(MdcKeys.JOB, jobId);
        ThreadContext.put(MdcKeys.JOB_RUN_ID, runId);

        JobRunSummary.Builder summary = JobRunSummary.builder();
        LocalDateTime startedAt = LocalDateTime.now();
        long startMs = System.currentTimeMillis();
        String status  = "SUCCESS";
        String message = null;
        try {
            return body.run(summary);
        } catch (Exception e) {
            status  = "FAILED";
            message = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            log.error("Job {} failed after {}ms: {}", jobId, System.currentTimeMillis() - startMs, message, e);
            throw (e instanceof RuntimeException re) ? re : new IllegalStateException(e);
        } finally {
            persist(jobId, runId, startedAt, System.currentTimeMillis() - startMs,
                    status, message, summary.build(), source, user);
            restore(MdcKeys.JOB, prevJob);
            restore(MdcKeys.JOB_RUN_ID, prevRunId);
        }
    }

    /**
     * Short, sortable-ish id. A full UUID is 36 chars of noise on every log line and in
     * every URL; 12 hex chars is ~2.8e14 values, which is plenty to keep one day's runs
     * distinct (the search is always scoped to a single job and date).
     */
    private String newRunId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private void restore(String key, String previous) {
        if (previous == null) {
            ThreadContext.remove(key);
        } else {
            ThreadContext.put(key, previous);
        }
    }

    /** Best-effort — a history-write failure must never take the job down with it. */
    private void persist(String jobId, String runId, LocalDateTime startedAt, long durationMs,
                         String status, String message, JobRunSummary summary,
                         TriggerSource source, String user) {
        try {
            historyRepo.save(SchedulerJobHistoryEntity.builder()
                    .jobName(jobId)
                    .runId(runId)
                    .startedAt(startedAt)
                    .durationMs(durationMs)
                    .status(status)
                    .message(message)
                    .summaryJson(toJson(summary))
                    .triggeredBy(source)
                    .triggeredByUser(user)
                    .build());
        } catch (Exception e) {
            log.error("Failed to persist scheduler history for {}: {}", jobId, e.getMessage());
        }
    }

    private String toJson(JobRunSummary summary) {
        if (summary == null || summary.isEmpty()) return null;
        try {
            return MAPPER.writeValueAsString(summary);
        } catch (Exception e) {
            log.warn("Failed to serialise run summary for history row: {}", e.getMessage());
            return null;
        }
    }
}
