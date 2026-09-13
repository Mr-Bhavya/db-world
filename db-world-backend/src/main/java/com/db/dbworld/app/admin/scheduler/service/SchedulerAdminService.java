package com.db.dbworld.app.admin.scheduler.service;

import com.db.dbworld.app.admin.scheduler.dto.JobRunSummary;
import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobConfigEntity;
import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobConfigEntity.JobType;
import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobHistoryEntity;
import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobHistoryEntity.TriggerSource;
import com.db.dbworld.app.admin.scheduler.repository.SchedulerJobConfigRepository;
import com.db.dbworld.app.admin.scheduler.repository.SchedulerJobHistoryRepository;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.app.cinema.catalog.tags.scheduler.TagScheduler;
import com.db.dbworld.app.cinema.tmdb.people.scheduler.PersonSyncScheduler;
import com.db.dbworld.app.cinema.tmdb.sync.scheduler.TmdbSyncScheduler;
import com.db.dbworld.app.ipo.scheduler.IpoLiveScheduler;
import com.db.dbworld.app.ipo.scheduler.IpoPollScheduler;
import com.db.dbworld.app.media.sync.MediaSyncService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Log4j2
@Service
@RequiredArgsConstructor
public class SchedulerAdminService {

    private final SchedulerJobConfigRepository  configRepo;
    private final SchedulerJobHistoryRepository historyRepo;
    private final TaskScheduler                 taskScheduler;
    private final TagScheduler                  tagScheduler;
    private final TmdbSyncScheduler             tmdbSyncScheduler;
    private final PersonSyncScheduler           personSyncScheduler;
    private final MediaSyncService              mediaSyncService;
    private final IpoPollScheduler              ipoPollScheduler;
    private final IpoLiveScheduler              ipoLiveScheduler;
    private final JdbcTemplate                  jdbcTemplate;
    private final JobRunRecorder                recorder;
    private final UserContext                   userContext;
    private final SchedulerHistoryRetentionService retentionService;

    /** See the note in {@code JobRunRecorder} on why this is a private Jackson 3 mapper. */
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> SUMMARY_MAP = new TypeReference<>() {};

    private static final List<SchedulerJobConfigEntity> DEFAULTS = List.of(
            SchedulerJobConfigEntity.builder().jobId("TagScheduler")
                    .jobType(JobType.CRON).cronExpression("0 0 */6 * * *")
                    .enabled(true).displayOrder(0).build(),
            SchedulerJobConfigEntity.builder().jobId("TmdbMovieSync")
                    .jobType(JobType.CRON).cronExpression("0 0 2 * * *")
                    .timezone("Asia/Kolkata").recheckIntervalHours(20)
                    .enabled(true).displayOrder(1).build(),
            SchedulerJobConfigEntity.builder().jobId("TmdbTvSync")
                    .jobType(JobType.CRON).cronExpression("0 10 2 * * *")
                    .timezone("Asia/Kolkata").recheckIntervalHours(20)
                    .enabled(true).displayOrder(2).build(),
            SchedulerJobConfigEntity.builder().jobId("PersonSyncScheduler")
                    .jobType(JobType.CRON).cronExpression("0 0 3 * * *")
                    .timezone("Asia/Kolkata").enabled(true).displayOrder(3).build(),
            // MediaSync runs every 60s and self-schedules via @Scheduled in
            // MediaSyncService — registered here only for admin visibility,
            // manual "Run Now", enable/disable, and per-job history. The
            // TaskScheduler path is skipped for FIXED_DELAY jobs.
            SchedulerJobConfigEntity.builder().jobId("MediaSync")
                    .jobType(JobType.FIXED_DELAY).intervalSeconds(60)
                    .stabilityWindowSeconds(5)
                    .enabled(true).displayOrder(4).build(),
            // A single IPO Guru /ipos call returns list + GMP + subscription together, so v1
            // needs only one cron cadence (no separate per-category schedules). Daytime-only
            // (10:00–20:00 IST, every 2h) so it never polls overnight — aligned with the IPO
            // notification window, so open/listed alerts fire from 10 AM and nothing is generated
            // at 12 AM. (Existing installs keep their stored cron — edit it on the admin Scheduler
            // page; this default only applies to a fresh seed.)
            SchedulerJobConfigEntity.builder().jobId(IpoPollScheduler.JOB_ID)
                    .jobType(JobType.CRON).cronExpression("0 0 10-20/2 * * *")
                    .timezone("Asia/Kolkata").enabled(true).displayOrder(5).build(),
            // IPO LIVE tier — refreshes GMP / subscription / lot / listing price AND delivers the
            // notifications that produces, every 30 min. Two HTTP calls per run plus a handful of
            // conditional ones (investorgain's live report + GMP dashboard cover every current IPO
            // at once), versus dozens for the source poll above — which is exactly why it's a
            // separate job: the numbers users stare at refresh on a short cycle without dragging
            // NSE's bootstrap dance and Chittorgarh's per-IPO detail pages along with them.
            // Offset to :15 and :45 so it never starts in lockstep with the poll on the hour.
            SchedulerJobConfigEntity.builder().jobId(IpoLiveScheduler.JOB_ID)
                    .jobType(JobType.CRON).cronExpression("0 15/30 10-20 * * *")
                    .timezone("Asia/Kolkata").enabled(true).displayOrder(6).build(),
            // Housekeeping for this very table. Runs at 04:30 IST — after the nightly TMDB/person
            // syncs have finished writing their rows and well before anyone is looking at the page.
            SchedulerJobConfigEntity.builder().jobId(SchedulerHistoryRetentionService.JOB_ID)
                    .jobType(JobType.CRON).cronExpression("0 30 4 * * *")
                    .timezone("Asia/Kolkata").enabled(true).displayOrder(7).build()
    );

    /**
     * Job ids that once existed and have since been folded into another job. Their stored config
     * rows have to be DELETED on boot, not just ignored: {@code scheduleAll()} schedules every row
     * it finds, and a row whose id the {@code runJob} switch no longer knows would fire and throw
     * {@code Unknown job} on every trigger. Per-job history rows are left alone as a record.
     */
    private static final List<String> RETIRED_JOB_IDS = List.of(
            // "ipo-notify" — its 30-minute delivery pass now runs inside ipo-live, right after the
            // refresh that detects the changes it delivers. Two crons for one pipeline meant an
            // alert could wait a tick for no reason.
            "ipo-notify");

    private final Map<String, String>            jobStatus = new ConcurrentHashMap<>();
    private final Map<String, ScheduledFuture<?>> futures  = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        relaxLegacyConstraints();
        retireRemovedJobs();
        seedDefaults();
        scheduleAll();
    }

    /** Deletes the config rows of jobs that have been folded into another job (see {@link #RETIRED_JOB_IDS}). */
    @Transactional
    public void retireRemovedJobs() {
        for (String jobId : RETIRED_JOB_IDS) {
            if (configRepo.existsById(jobId)) {
                configRepo.deleteById(jobId);
                log.info("Retired scheduler config for {} — its work now runs inside another job", jobId);
            }
        }
    }

    /**
     * One-shot schema fix: the original {@code scheduler_job_config} table was
     * created with {@code cron_expression VARCHAR(100) NOT NULL} when every job
     * was cron-based. FIXED_DELAY jobs (MediaSync) leave that column null, and
     * Hibernate's {@code ddl-auto=update} doesn't relax existing NOT NULL
     * constraints — only Flyway/Liquibase would.
     *
     * <p>The {@code ALTER TABLE ... MODIFY} is idempotent on MySQL: if the
     * column is already nullable, this is a no-op (it just rewrites the column
     * metadata to match). Wrapped in try/catch so an unexpected DB layout
     * doesn't block boot.
     */
    private void relaxLegacyConstraints() {
        try {
            jdbcTemplate.execute(
                    "ALTER TABLE scheduler_job_config " +
                    "MODIFY COLUMN cron_expression VARCHAR(100) NULL");
        } catch (Exception e) {
            log.debug("scheduler_job_config.cron_expression NOT NULL relax skipped: {}",
                    e.getMessage());
        }
    }

    @Transactional
    public void seedDefaults() {
        for (SchedulerJobConfigEntity def : DEFAULTS) {
            if (!configRepo.existsById(def.getJobId())) {
                configRepo.save(def);
                log.info("Seeded scheduler config for {}", def.getJobId());
            }
        }
    }

    private void scheduleAll() {
        configRepo.findAll().forEach(this::scheduleJob);
    }

    private void scheduleJob(SchedulerJobConfigEntity config) {
        cancelIfRunning(config.getJobId());
        // Fixed-delay jobs schedule themselves via @Scheduled in their own
        // service (e.g. MediaSyncService). We only persist config + write
        // history; the TaskScheduler path is for cron jobs only.
        if (config.getJobType() == JobType.FIXED_DELAY) {
            log.info("Registered {} (FIXED_DELAY, every {}s, enabled={}) — self-scheduled",
                    config.getJobId(), config.getIntervalSeconds(), config.isEnabled());
            return;
        }
        Runnable task = () -> runJob(config.getJobId());
        CronTrigger trigger = config.getTimezone() != null
                ? new CronTrigger(config.getCronExpression(), TimeZone.getTimeZone(config.getTimezone()))
                : new CronTrigger(config.getCronExpression());
        futures.put(config.getJobId(), taskScheduler.schedule(task, trigger));
        log.info("Scheduled {} cron='{}' enabled={}", config.getJobId(), config.getCronExpression(), config.isEnabled());
    }

    private void cancelIfRunning(String jobId) {
        ScheduledFuture<?> f = futures.remove(jobId);
        if (f != null) f.cancel(false);
    }

    // ── Job execution ────────────────────────────────────────────────────────────

    public boolean triggerNow(String jobId) {
        if (!configRepo.existsById(jobId)) return false;
        if ("RUNNING".equals(jobStatus.get(jobId))) {
            log.warn("Job {} already running — skipping manual trigger", jobId);
            return false;
        }
        // Resolve the admin here, on the request thread — the run happens on a bare thread
        // with no SecurityContext, so asking for it over there would always come back empty.
        String triggeredBy = userContext.optionalUser().map(u -> u.email()).orElse(null);
        Thread t = new Thread(() -> runJob(jobId, TriggerSource.MANUAL, triggeredBy),
                "manual-trigger-" + jobId);
        t.setDaemon(true);
        t.start();
        return true;
    }

    /** Cron-trigger entry point. */
    public void runJob(String jobId) {
        runJob(jobId, TriggerSource.SCHEDULED, null);
    }

    /**
     * Stops the run currently executing for {@code jobId}.
     *
     * @return false when nothing is running for that job — the caller reports a conflict
     *         rather than pretending it cancelled something
     */
    public boolean cancelRunning(String jobId) {
        boolean cancelled = recorder.cancel(jobId);
        if (cancelled) {
            log.info("Admin cancelled running job: {}", jobId);
        }
        return cancelled;
    }

    public void runJob(String jobId, TriggerSource source, String triggeredByUser) {
        SchedulerJobConfigEntity config = configRepo.findById(jobId).orElse(null);
        if (config != null && !config.isEnabled()) {
            log.debug("Job {} is disabled, skipping", jobId);
            return;
        }
        jobStatus.put(jobId, "RUNNING");
        try {
            recorder.run(jobId, source, triggeredByUser, summary -> {
                dispatch(jobId, summary);
                return null;
            });
        } catch (Exception e) {
            // Already logged and written as a FAILED history row by the recorder. Swallowed
            // here so a failing job never escapes into the TaskScheduler's error handler.
        } finally {
            jobStatus.put(jobId, "IDLE");
        }
    }

    /**
     * Runs the job body, reporting what it did into {@code summary}.
     *
     * <p>Jobs that already return a structured result ({@code pollOnce}) are mapped here;
     * the rest fill the builder as they go, so a run that dies halfway still records the
     * work it completed.
     */
    private void dispatch(String jobId, JobRunSummary.Builder summary) {
        switch (jobId) {
            case "TagScheduler"        -> tagScheduler.updateTags(summary);
            case "TmdbMovieSync"       -> tmdbSyncScheduler.runMovieSync(summary);
            case "TmdbTvSync"          -> tmdbSyncScheduler.runTvSync(summary);
            case "PersonSyncScheduler" -> personSyncScheduler.runPersonSync(summary);
            case "MediaSync"           -> mediaSyncService.scan(summary);
            case IpoPollScheduler.JOB_ID -> {
                var result = ipoPollScheduler.pollOnce();
                summary.count("sourcesPolled", result.sourcesPolled())
                       .count("sourcesFailed", result.sourcesFailed())
                       .count("iposSeen",      result.ipoCount());
            }
            case IpoLiveScheduler.JOB_ID -> ipoLiveScheduler.refreshOnce(summary);
            case SchedulerHistoryRetentionService.JOB_ID -> retentionService.prune(summary);
            default -> throw new IllegalArgumentException("Unknown job: " + jobId);
        }
    }

    // ── Public query API ─────────────────────────────────────────────────────────

    public List<Map<String, Object>> listJobs(long unsyncedPersons) {
        return configRepo.findAll().stream()
                .sorted(Comparator.comparingInt(SchedulerJobConfigEntity::getDisplayOrder))
                .map(c -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",              c.getJobId());
                    // Admin-overridden displayName wins; fall back to the
                    // hardcoded default for the job id so legacy rows /
                    // newly-seeded jobs still render a sensible label.
                    m.put("name", (c.getDisplayName() != null && !c.getDisplayName().isBlank())
                            ? c.getDisplayName()
                            : displayName(c.getJobId()));
                    m.put("defaultName",     displayName(c.getJobId()));
                    m.put("jobType",         c.getJobType().name());
                    if (c.getCronExpression() != null)        m.put("cronExpression",        c.getCronExpression());
                    if (c.getIntervalSeconds() != null)       m.put("intervalSeconds",       c.getIntervalSeconds());
                    if (c.getStabilityWindowSeconds() != null) m.put("stabilityWindowSeconds", c.getStabilityWindowSeconds());
                    if (c.getRecheckIntervalHours() != null)   m.put("recheckIntervalHours",   c.getRecheckIntervalHours());
                    if (c.getTimezone() != null)              m.put("timezone",              c.getTimezone());
                    if (c.getNotes() != null && !c.getNotes().isBlank()) m.put("notes", c.getNotes());
                    m.put("enabled",         c.isEnabled());
                    m.put("status",          jobStatus.getOrDefault(c.getJobId(), "IDLE"));
                    m.put("description",     description(c.getJobId(), unsyncedPersons));
                    m.put("displayOrder",    c.getDisplayOrder());

                    // Last-run outcome and what comes next. The admin page carried a
                    // "Last Failed" chip that could never render, because nothing here
                    // ever sent a lastStatus — so a job that had been failing every
                    // night read exactly like one that had never failed.
                    RunStats stats = runStats(c.getJobId());
                    m.put("lastStatus",          stats.status());
                    m.put("lastRunAt",           stats.startedAt());
                    m.put("lastDurationMs",      stats.durationMs());
                    m.put("lastMessage",         stats.message());
                    m.put("lastRunId",           stats.runId());
                    m.put("lastSummary",         parseSummary(stats.summaryJson()));
                    m.put("consecutiveFailures", stats.consecutiveFailures());
                    m.put("nextRunAt",           nextRunAt(c, stats.startedAt()));
                    // Typical duration, so the page can say "running 12m — usually 4m".
                    // That comparison is the actual answer to "is it stuck?", and it needs
                    // no data beyond the history already read above.
                    m.put("expectedDurationMs",  stats.medianDurationMs());

                    // A run still going: when it started and how far it has got. Without
                    // these a long job is an unchanging spinner.
                    recorder.current(c.getJobId()).ifPresent(run -> {
                        m.put("currentRunId",        run.runId());
                        m.put("currentRunStartedAt", run.startedAt());
                        Map<String, Long> live = run.summary().liveCounters();
                        if (!live.isEmpty()) m.put("currentCounters", live);
                    });
                    return m;
                }).toList();
    }

    /**
     * Last-run facts for one job, plus how many runs in a row have failed.
     *
     * <p>A single failure is noise — an upstream feed hiccups. The same job failing
     * every night for a week is an outage nobody noticed, and the two have to look
     * different on the page.
     */
    private record RunStats(String status, LocalDateTime startedAt, Long durationMs,
                            String message, String runId, String summaryJson,
                            int consecutiveFailures, Long medianDurationMs) {
        static final RunStats NONE = new RunStats(null, null, null, null, null, null, 0, null);
    }

    /**
     * How far back the failure streak is counted. One indexed page per job (there are
     * under a dozen) is cheaper and far more portable than a window function, which
     * would have to behave identically on MySQL and on H2 in the tests.
     */
    private static final int STREAK_WINDOW = 25;

    private RunStats runStats(String jobId) {
        List<SchedulerJobHistoryEntity> recent =
                historyRepo.findByJobNameOrderByStartedAtDesc(jobId, PageRequest.of(0, STREAK_WINDOW));
        if (recent.isEmpty()) return RunStats.NONE;

        int streak = 0;
        for (SchedulerJobHistoryEntity h : recent) {
            if (!"FAILED".equals(h.getStatus())) break;
            streak++;
        }
        SchedulerJobHistoryEntity last = recent.getFirst();
        return new RunStats(last.getStatus(), last.getStartedAt(), last.getDurationMs(),
                last.getMessage(), last.getRunId(), last.getSummaryJson(), streak,
                medianSuccessfulDuration(recent));
    }

    /**
     * Median duration of the recent SUCCESSFUL runs, or null when there aren't enough to
     * mean anything.
     *
     * <p>Median rather than mean: one cold-start run that took forty times as long as usual
     * would drag an average far enough to make every later run look fast. Failures are
     * excluded because a run that died in 200ms says nothing about how long the work takes.
     */
    private Long medianSuccessfulDuration(List<SchedulerJobHistoryEntity> recent) {
        List<Long> durations = recent.stream()
                .filter(h -> "SUCCESS".equals(h.getStatus()))
                .map(SchedulerJobHistoryEntity::getDurationMs)
                .filter(Objects::nonNull)
                .sorted()
                .toList();
        if (durations.size() < 3) return null;
        return durations.get(durations.size() / 2);
    }

    /**
     * When this job fires next, or null when it never will.
     *
     * <p>A disabled job has no next run — saying "in 20h" about something that is
     * switched off is worse than saying nothing. FIXED_DELAY jobs self-schedule from
     * the end of the previous run, so their estimate is derived from the last run
     * rather than from a cron expression; before the first run there is nothing to
     * derive it from.
     */
    private LocalDateTime nextRunAt(SchedulerJobConfigEntity c, LocalDateTime lastRunAt) {
        if (!c.isEnabled()) return null;
        try {
            if (c.getJobType() == JobType.FIXED_DELAY) {
                if (c.getIntervalSeconds() == null || lastRunAt == null) return null;
                return lastRunAt.plusSeconds(c.getIntervalSeconds());
            }
            if (c.getCronExpression() == null) return null;
            ZoneId zone = c.getTimezone() != null ? ZoneId.of(c.getTimezone()) : ZoneId.systemDefault();
            ZonedDateTime next = CronExpression.parse(c.getCronExpression()).next(ZonedDateTime.now(zone));
            // Normalised to the server's local time so the UI can treat it exactly like
            // startedAt, instead of having two date fields with different semantics.
            return next == null ? null : next.withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
        } catch (Exception e) {
            // A cron expression the admin typed by hand can be invalid; the page should
            // still render every other fact about the job.
            log.debug("Could not compute next run for {}: {}", c.getJobId(), e.getMessage());
            return null;
        }
    }

    public List<Map<String, Object>> getHistory(int limit) {
        return historyRepo.findAllByOrderByStartedAtDesc(PageRequest.of(0, limit)).stream()
                .map(this::toHistoryRow).toList();
    }

    /** Per-job history feed for the admin UI's per-card history drawer. */
    public List<Map<String, Object>> getHistoryForJob(String jobName, int limit) {
        return historyRepo.findByJobNameOrderByStartedAtDesc(jobName, PageRequest.of(0, limit)).stream()
                .map(this::toHistoryRow).toList();
    }

    private Map<String, Object> toHistoryRow(SchedulerJobHistoryEntity h) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",         h.getId());
        m.put("jobName",    h.getJobName());
        m.put("startedAt",  h.getStartedAt());
        m.put("durationMs", h.getDurationMs());
        m.put("status",     h.getStatus());
        m.put("message",    h.getMessage());
        // runId is null on rows written before run correlation existed — the UI hides the
        // "view logs" affordance for those rather than offering a search that can't hit.
        m.put("runId",      h.getRunId());
        m.put("summary",    parseSummary(h.getSummaryJson()));
        m.put("triggeredBy",     h.getTriggeredBy() != null ? h.getTriggeredBy().name() : null);
        m.put("triggeredByUser", h.getTriggeredByUser());
        return m;
    }

    /**
     * Inflates the stored summary so the UI receives an object, not a JSON string it would
     * have to parse itself. A row whose JSON is unreadable (hand-edited, or written by an
     * older shape) degrades to null rather than failing the whole history request.
     */
    private Map<String, Object> parseSummary(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return MAPPER.readValue(json, SUMMARY_MAP);
        } catch (Exception e) {
            log.debug("Unreadable scheduler run summary JSON, ignoring: {}", e.getMessage());
            return null;
        }
    }

    // ── Mutation API ─────────────────────────────────────────────────────────────

    @Transactional
    public boolean toggle(String jobId) {
        SchedulerJobConfigEntity config = configRepo.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown job: " + jobId));
        config.setEnabled(!config.isEnabled());
        configRepo.save(config);
        log.info("Job {} {}", jobId, config.isEnabled() ? "enabled" : "disabled");
        return config.isEnabled();
    }

    @Transactional
    public void updateCron(String jobId, String cronExpression, String timezone) {
        SchedulerJobConfigEntity config = configRepo.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown job: " + jobId));
        if (config.getJobType() == JobType.FIXED_DELAY) {
            throw new IllegalArgumentException(
                    "Job " + jobId + " is FIXED_DELAY — use /interval/{jobName} to change its cadence");
        }
        config.setCronExpression(cronExpression);
        if (timezone != null && !timezone.isBlank()) config.setTimezone(timezone);
        configRepo.save(config);
        scheduleJob(config);
        log.info("Job {} rescheduled with cron '{}'", jobId, cronExpression);
    }

    /**
     * Update the run interval of a FIXED_DELAY job. The change is picked up
     * by the job's SchedulingConfigurer on its next scheduling decision —
     * no restart, no re-register. CRON jobs reject this path.
     */
    @Transactional
    public void updateInterval(String jobId, int intervalSeconds) {
        if (intervalSeconds <= 0) {
            throw new IllegalArgumentException("intervalSeconds must be > 0");
        }
        SchedulerJobConfigEntity config = configRepo.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown job: " + jobId));
        if (config.getJobType() != JobType.FIXED_DELAY) {
            throw new IllegalArgumentException(
                    "Job " + jobId + " is CRON — use /cron/{jobName} to change its schedule");
        }
        config.setIntervalSeconds(intervalSeconds);
        configRepo.save(config);
        log.info("Job {} interval updated to {}s (effective next tick)", jobId, intervalSeconds);
    }

    /**
     * Partial update — any subset of {@code displayName}, {@code notes}, or
     * {@code stabilityWindowSeconds} may be set. Null/missing values leave the
     * existing column untouched; empty strings clear the override and fall
     * back to defaults. Used by the consolidated PATCH endpoint so the admin
     * UI doesn't need a separate request per field.
     */
    @Transactional
    public void updateSettings(String jobId,
                               String displayName,
                               String notes,
                               Integer stabilityWindowSeconds,
                               Integer recheckIntervalHours) {
        SchedulerJobConfigEntity config = configRepo.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown job: " + jobId));

        if (displayName != null) {
            // Empty string → clear override (fall back to code-side default).
            config.setDisplayName(displayName.isBlank() ? null : displayName);
        }
        if (notes != null) {
            config.setNotes(notes.isBlank() ? null : notes);
        }
        if (stabilityWindowSeconds != null) {
            if (stabilityWindowSeconds < 0) {
                throw new IllegalArgumentException("stabilityWindowSeconds must be >= 0");
            }
            config.setStabilityWindowSeconds(stabilityWindowSeconds);
        }
        if (recheckIntervalHours != null) {
            if (recheckIntervalHours <= 0) {
                throw new IllegalArgumentException("recheckIntervalHours must be > 0");
            }
            config.setRecheckIntervalHours(recheckIntervalHours);
        }
        configRepo.save(config);
        log.info("Job {} settings updated (displayName={}, notes={}chars, stabilityWindow={}s, recheckIntervalHours={})",
                jobId,
                config.getDisplayName(),
                config.getNotes() != null ? config.getNotes().length() : 0,
                config.getStabilityWindowSeconds(),
                config.getRecheckIntervalHours());
    }

    /** Reads the stability window for a job, falling back to {@code defaultSec} if unset. */
    public int stabilityWindowSeconds(String jobId, int defaultSec) {
        return configRepo.findById(jobId)
                .map(SchedulerJobConfigEntity::getStabilityWindowSeconds)
                .filter(java.util.Objects::nonNull)
                .filter(i -> i >= 0)
                .orElse(defaultSec);
    }

    @Transactional
    public void reorder(List<Map<String, Object>> orders) {
        for (Map<String, Object> item : orders) {
            String jobId = (String) item.get("id");
            int order    = ((Number) item.get("order")).intValue();
            configRepo.findById(jobId).ifPresent(c -> {
                c.setDisplayOrder(order);
                configRepo.save(c);
            });
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private static String displayName(String jobId) {
        return switch (jobId) {
            case "TagScheduler"        -> "Tag Scheduler";
            case "TmdbMovieSync"       -> "TMDB Movie Sync";
            case "TmdbTvSync"          -> "TMDB TV Sync";
            case "PersonSyncScheduler" -> "Person Detail Sync";
            case "MediaSync"           -> "Media File Sync";
            case IpoPollScheduler.JOB_ID -> "IPO Tracker Poll";
            case IpoLiveScheduler.JOB_ID -> "IPO Live GMP, Subscription & Alerts";
            case SchedulerHistoryRetentionService.JOB_ID -> "Run History Cleanup";
            default -> jobId;
        };
    }

    private static String description(String jobId, long unsyncedPersons) {
        return switch (jobId) {
            case "TagScheduler"        -> "Recalculates tag pools: Trending, Featured, New and all genre rails";
            case "TmdbMovieSync"       -> "Syncs updated movie metadata and images from TMDB (2:00 AM IST)";
            case "TmdbTvSync"          -> "Syncs updated TV series metadata and images from TMDB (2:10 AM IST)";
            case "PersonSyncScheduler" -> "Fetches full biography and images for unsynced cast/crew (" + unsyncedPersons + " pending)";
            case "MediaSync"           -> "Reconciles media_files against the stream directory — picks up SSH/SMB/file-manager adds, deletes, renames";
            case IpoPollScheduler.JOB_ID -> "Polls enabled IPO sources (IPO Guru, NSE, Chittorgarh), merges and ingests listing/GMP/subscription updates";
            case IpoLiveScheduler.JOB_ID -> "Refreshes live GMP, subscription, rating, market lot, P/E and listing price from investorgain, then sends any IPO push still pending \u2014 every 30 min inside the IST market window";
            case SchedulerHistoryRetentionService.JOB_ID -> "Deletes scheduler run history past its retention window — lengths are set under Settings → Scheduler (4:30 AM IST)";
            default -> "";
        };
    }
}
