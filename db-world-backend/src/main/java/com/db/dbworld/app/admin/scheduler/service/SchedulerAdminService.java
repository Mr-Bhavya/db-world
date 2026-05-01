package com.db.dbworld.app.admin.scheduler.service;

import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobConfigEntity;
import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobHistoryEntity;
import com.db.dbworld.app.admin.scheduler.repository.SchedulerJobConfigRepository;
import com.db.dbworld.app.admin.scheduler.repository.SchedulerJobHistoryRepository;
import com.db.dbworld.app.cinema.catalog.tags.scheduler.TagScheduler;
import com.db.dbworld.app.cinema.tmdb.people.scheduler.PersonSyncScheduler;
import com.db.dbworld.app.cinema.tmdb.sync.scheduler.TmdbSyncScheduler;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
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

    private static final List<SchedulerJobConfigEntity> DEFAULTS = List.of(
            SchedulerJobConfigEntity.builder().jobId("TagScheduler")
                    .cronExpression("0 0 */6 * * *").enabled(true).displayOrder(0).build(),
            SchedulerJobConfigEntity.builder().jobId("TmdbMovieSync")
                    .cronExpression("0 0 2 * * *").timezone("Asia/Kolkata").enabled(true).displayOrder(1).build(),
            SchedulerJobConfigEntity.builder().jobId("TmdbTvSync")
                    .cronExpression("0 10 2 * * *").timezone("Asia/Kolkata").enabled(true).displayOrder(2).build(),
            SchedulerJobConfigEntity.builder().jobId("PersonSyncScheduler")
                    .cronExpression("0 0 3 * * *").timezone("Asia/Kolkata").enabled(true).displayOrder(3).build()
    );

    private final Map<String, String>            jobStatus = new ConcurrentHashMap<>();
    private final Map<String, ScheduledFuture<?>> futures  = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        seedDefaults();
        scheduleAll();
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
        Thread t = new Thread(() -> runJob(jobId), "manual-trigger-" + jobId);
        t.setDaemon(true);
        t.start();
        return true;
    }

    public void runJob(String jobId) {
        SchedulerJobConfigEntity config = configRepo.findById(jobId).orElse(null);
        if (config != null && !config.isEnabled()) {
            log.debug("Job {} is disabled, skipping", jobId);
            return;
        }
        jobStatus.put(jobId, "RUNNING");
        LocalDateTime startedAt = LocalDateTime.now();
        long startMs = System.currentTimeMillis();
        String status  = "SUCCESS";
        String message = null;
        try {
            switch (jobId) {
                case "TagScheduler"        -> tagScheduler.updateTags();
                case "TmdbMovieSync"       -> tmdbSyncScheduler.runMovieSync();
                case "TmdbTvSync"          -> tmdbSyncScheduler.runTvSync();
                case "PersonSyncScheduler" -> personSyncScheduler.runPersonSync();
                default -> throw new IllegalArgumentException("Unknown job: " + jobId);
            }
        } catch (Exception e) {
            status  = "FAILED";
            message = e.getMessage();
            log.error("Job {} failed after {}ms: {}", jobId, System.currentTimeMillis() - startMs, e.getMessage(), e);
        } finally {
            long durationMs = System.currentTimeMillis() - startMs;
            jobStatus.put(jobId, "IDLE");
            persistHistory(jobId, startedAt, durationMs, status, message);
        }
    }

    private void persistHistory(String jobName, LocalDateTime startedAt, long durationMs, String status, String message) {
        try {
            historyRepo.save(SchedulerJobHistoryEntity.builder()
                    .jobName(jobName).startedAt(startedAt)
                    .durationMs(durationMs).status(status).message(message)
                    .build());
        } catch (Exception e) {
            log.error("Failed to persist scheduler history for {}: {}", jobName, e.getMessage());
        }
    }

    // ── Public query API ─────────────────────────────────────────────────────────

    public List<Map<String, Object>> listJobs(long unsyncedPersons) {
        return configRepo.findAll().stream()
                .sorted(Comparator.comparingInt(SchedulerJobConfigEntity::getDisplayOrder))
                .map(c -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",             c.getJobId());
                    m.put("name",           displayName(c.getJobId()));
                    m.put("cronExpression", c.getCronExpression());
                    if (c.getTimezone() != null) m.put("timezone", c.getTimezone());
                    m.put("enabled",        c.isEnabled());
                    m.put("status",         jobStatus.getOrDefault(c.getJobId(), "IDLE"));
                    m.put("description",    description(c.getJobId(), unsyncedPersons));
                    m.put("displayOrder",   c.getDisplayOrder());
                    return m;
                }).toList();
    }

    public List<Map<String, Object>> getHistory(int limit) {
        return historyRepo.findAllByOrderByStartedAtDesc(PageRequest.of(0, limit)).stream()
                .map(h -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("jobName",    h.getJobName());
                    m.put("startedAt",  h.getStartedAt());
                    m.put("durationMs", h.getDurationMs());
                    m.put("status",     h.getStatus());
                    m.put("message",    h.getMessage());
                    return m;
                }).toList();
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
        config.setCronExpression(cronExpression);
        if (timezone != null && !timezone.isBlank()) config.setTimezone(timezone);
        configRepo.save(config);
        scheduleJob(config);
        log.info("Job {} rescheduled with cron '{}'", jobId, cronExpression);
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
            default -> jobId;
        };
    }

    private static String description(String jobId, long unsyncedPersons) {
        return switch (jobId) {
            case "TagScheduler"        -> "Recalculates tag pools: Trending, Featured, New and all genre rails";
            case "TmdbMovieSync"       -> "Syncs updated movie metadata and images from TMDB (2:00 AM IST)";
            case "TmdbTvSync"          -> "Syncs updated TV series metadata and images from TMDB (2:10 AM IST)";
            case "PersonSyncScheduler" -> "Fetches full biography and images for unsynced cast/crew (" + unsyncedPersons + " pending)";
            default -> "";
        };
    }
}
