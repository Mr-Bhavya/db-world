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
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

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
     * Runs currently in flight, by job id.
     *
     * <p>This is what lets the admin page say something about a job that is STILL GOING.
     * Without it a seven-minute TMDB sync is an unchanging spinner, and there is no way to
     * tell "working through 900 records" from "hung on a dead connection".
     */
    private final Map<String, InFlight> inFlight = new ConcurrentHashMap<>();

    /** A run in progress: its id, start, live counters, and the thread doing the work. */
    public record InFlight(String runId, LocalDateTime startedAt, JobRunSummary.Builder summary,
                           Thread thread, AtomicBoolean cancelRequested) {}

    /** The run currently executing for {@code jobId}, if any. */
    public Optional<InFlight> current(String jobId) {
        return Optional.ofNullable(inFlight.get(jobId));
    }

    /**
     * Asks the running job to stop, by interrupting the thread executing it.
     *
     * <p>Interruption rather than a bespoke cancel flag, because the long jobs already
     * respond to it: PersonSync's rate-limit {@code Thread.sleep} throws, and the TMDB
     * sync's {@code blockLast()} throws and disposes the reactive pipeline underneath it.
     * A separate flag would need every loop to remember to poll it; this one is understood
     * by the blocking calls the jobs already make.
     *
     * <p>The flag is recorded separately so the run is filed as CANCELLED rather than
     * FAILED — someone pressing stop is not an incident.
     *
     * @return false when that job is not currently running
     */
    public boolean cancel(String jobId) {
        InFlight run = inFlight.get(jobId);
        if (run == null) return false;
        run.cancelRequested().set(true);
        run.thread().interrupt();
        log.info("Cancellation requested for job {} (run {})", jobId, run.runId());
        return true;
    }

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
        AtomicBoolean cancelRequested = new AtomicBoolean();
        inFlight.put(jobId, new InFlight(runId, startedAt, summary, Thread.currentThread(), cancelRequested));
        String status  = "SUCCESS";
        String message = null;
        try {
            return body.run(summary);
        } catch (Exception e) {
            if (cancelRequested.get()) {
                status  = "CANCELLED";
                message = "Cancelled after " + (System.currentTimeMillis() - startMs) + "ms";
                log.info("Job {} cancelled after {}ms", jobId, System.currentTimeMillis() - startMs);
            } else {
                status  = "FAILED";
                message = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                log.error("Job {} failed after {}ms: {}", jobId, System.currentTimeMillis() - startMs, message, e);
            }
            throw (e instanceof RuntimeException re) ? re : new IllegalStateException(e);
        } finally {
            inFlight.remove(jobId);
            // Clear the interrupt before handing the thread back. Cron jobs run on a POOLED
            // TaskScheduler thread, and leaving it interrupted would make the next unrelated
            // job to land on it die instantly.
            Thread.interrupted();
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
