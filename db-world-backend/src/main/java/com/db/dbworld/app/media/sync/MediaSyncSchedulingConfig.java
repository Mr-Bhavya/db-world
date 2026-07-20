package com.db.dbworld.app.media.sync;

import com.db.dbworld.app.admin.scheduler.entity.SchedulerJobConfigEntity;
import com.db.dbworld.app.admin.scheduler.repository.SchedulerJobConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

/**
 * Registers {@link MediaSyncService#scheduledScan()} as a trigger-driven task
 * whose next-execution time is computed from the live database value of
 * {@code scheduler_job_config.interval_seconds}.
 *
 * <p>Replaces the previous {@code @Scheduled(fixedDelayString = "${...}")}
 * approach, where the delay was bound once at startup from application.yml.
 * With the Trigger pattern, Spring's scheduler calls
 * {@link #nextExecution} after every run, so changing the interval via the
 * admin scheduler UI takes effect on the next tick — no restart needed.
 *
 * <p>Why a separate {@code @Configuration} class:
 * <ul>
 *   <li>Keeps {@link MediaSyncService} free of scheduling-framework wiring
 *       (it remains a plain bean exposing {@code scheduledScan()} and
 *       {@code scan()}).</li>
 *   <li>{@link SchedulingConfigurer} is the canonical Spring hook for
 *       programmatic schedule registration — recognised at context refresh
 *       and applied to the same {@code TaskScheduler} the rest of
 *       {@code @Scheduled} jobs use.</li>
 *   <li>Plays nicely with {@code @EnableScheduling} elsewhere — both
 *       registration paths coexist.</li>
 * </ul>
 */
@Configuration
@EnableScheduling
@RequiredArgsConstructor
@Log4j2
public class MediaSyncSchedulingConfig implements SchedulingConfigurer {

    /** Used when no config row exists yet (very-first boot before seedDefaults). */
    private static final long DEFAULT_INTERVAL_SECONDS = 60L;

    private final MediaSyncService               mediaSyncService;
    private final SchedulerJobConfigRepository   schedulerConfigRepo;

    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        registrar.addTriggerTask(
                mediaSyncService::scheduledScan,
                this::nextExecution);
        log.info("MediaSync scheduling registered (trigger-driven; reads interval from scheduler_job_config)");
    }

    /**
     * Trigger callback. Spring invokes this after each scan to determine the
     * next execution instant. Reads the current interval from the DB on
     * every call so admin UI edits take effect immediately.
     */
    private Instant nextExecution(org.springframework.scheduling.TriggerContext ctx) {
        long intervalSeconds = currentIntervalSeconds();

        // Base the next execution on lastCompletion (fixed-delay semantics) if
        // available; otherwise on lastScheduledExecution (handles the brief
        // window where the previous run hasn't finished yet); otherwise "now"
        // (first call, no history).
        Instant base = Optional.ofNullable(ctx.lastCompletion())
                .or(() -> Optional.ofNullable(ctx.lastScheduledExecution()))
                .orElseGet(Instant::now);

        return base.plusSeconds(intervalSeconds);
    }

    private long currentIntervalSeconds() {
        try {
            return schedulerConfigRepo.findById(MediaSyncService.JOB_ID)
                    .map(SchedulerJobConfigEntity::getIntervalSeconds)
                    .filter(Objects::nonNull)
                    .filter(i -> i > 0)
                    .map(Integer::longValue)
                    .orElse(DEFAULT_INTERVAL_SECONDS);
        } catch (Exception e) {
            // DB unreachable at scheduling time — keep the previous default so
            // the scan loop doesn't get permanently wedged.
            log.warn("MediaSync: failed to read interval from config (using default {}s): {}",
                    DEFAULT_INTERVAL_SECONDS, e.getMessage());
            return DEFAULT_INTERVAL_SECONDS;
        }
    }
}
