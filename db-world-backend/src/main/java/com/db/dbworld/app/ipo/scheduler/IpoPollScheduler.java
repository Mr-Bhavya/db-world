package com.db.dbworld.app.ipo.scheduler;

import com.db.dbworld.app.ipo.dto.IpoDto;
import com.db.dbworld.app.ipo.notification.IpoLifecycleChange;
import com.db.dbworld.app.ipo.notification.IpoNotificationService;
import com.db.dbworld.app.ipo.service.InvestorgainGmpService;
import com.db.dbworld.app.ipo.service.IpoIngestService;
import com.db.dbworld.app.ipo.service.IpoMergeService;
import com.db.dbworld.app.ipo.service.IpoSourcePollService;
import com.db.dbworld.app.ipo.source.IpoSource;
import com.db.dbworld.app.ipo.source.IpoSourceRegistry;

import lombok.extern.log4j.Log4j2;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

/**
 * Orchestrates one IPO poll cycle: fetches every enabled {@link IpoSource}, records per-source
 * health via {@link IpoSourcePollService}, then merges and ingests whatever came back.
 *
 * <p>Driven by the {@code ipo-poll} entry in {@code scheduler_job_config} (wired through the
 * existing generic {@code SchedulerAdminService} cron dispatch — see that class for the
 * seed/cron-edit/RUNNING-guard mechanics). This class itself has no scheduling-framework
 * dependency and is safe to call directly (e.g. from a test or an admin "run now" action).
 *
 * <p>One bad source must never abort the others: each source is fetched inside its own
 * try/catch. {@link IpoSource} implementations are contractually expected to swallow their own
 * expected upstream failures and return {@code List.of()} instead of throwing (see
 * {@link IpoSource#fetchAll()}), so the catch here is a defensive backstop, not the primary
 * failure path — but when it does trigger, the remaining sources still run and the cycle still
 * merges + ingests whatever was collected.
 */
@Log4j2
@Component
public class IpoPollScheduler {

    /** Scheduler job id used in scheduler_job_config (mirrors MediaSyncService.JOB_ID). */
    public static final String JOB_ID = "ipo-poll";

    private static final String STATUS_FAILED = "FAILED";

    private final IpoSourceRegistry registry;
    private final IpoMergeService mergeService;
    private final IpoIngestService ingestService;
    private final IpoSourcePollService pollService;
    private final InvestorgainGmpService gmpService;
    private final IpoNotificationService notificationService;
    private final Supplier<Instant> now;

    @Autowired
    public IpoPollScheduler(IpoSourceRegistry registry, IpoMergeService mergeService,
                             IpoIngestService ingestService, IpoSourcePollService pollService,
                             InvestorgainGmpService gmpService, IpoNotificationService notificationService) {
        this(registry, mergeService, ingestService, pollService, gmpService, notificationService, Instant::now);
    }

    /** Test-friendly constructor with an injectable clock for deterministic {@code now()}. */
    IpoPollScheduler(IpoSourceRegistry registry, IpoMergeService mergeService,
                      IpoIngestService ingestService, IpoSourcePollService pollService,
                      InvestorgainGmpService gmpService, IpoNotificationService notificationService,
                      Supplier<Instant> now) {
        this.registry = registry;
        this.mergeService = mergeService;
        this.ingestService = ingestService;
        this.pollService = pollService;
        this.gmpService = gmpService;
        this.notificationService = notificationService;
        this.now = now;
    }

    /**
     * Runs a single poll cycle: fetch every enabled source, record health, merge, ingest.
     * Safe to call repeatedly — merge/ingest are idempotent over unchanged data.
     */
    public IpoPollResult pollOnce() {
        List<IpoSource> sources = registry.enabled();
        List<IpoDto> allDtos = new ArrayList<>();
        int sourcesFailed = 0;

        for (IpoSource source : sources) {
            Instant polledAt = now.get();
            try {
                List<IpoDto> dtos = source.fetchAll();
                allDtos.addAll(dtos);
                pollService.recordSuccess(source.key(), polledAt);
            } catch (Exception e) {
                sourcesFailed++;
                pollService.recordFailure(source.key(), polledAt, STATUS_FAILED);
                log.warn("IPO poll: source '{}' threw — recorded failure and continuing: {}",
                        source.key(), e.toString());
            }
        }

        List<IpoDto> merged = mergeService.merge(allDtos);
        List<IpoLifecycleChange> changes = ingestService.ingest(merged);

        // GMP is a day-wise time series from investorgain (not part of the source→merge→ingest
        // snapshot pipeline), backfilled AFTER ingest so the listings it matches against already
        // exist. Best-effort — refreshGmp never throws, so a GMP hiccup can't fail the poll.
        gmpService.refreshGmp();

        // Broadcast the notification-worthy changes from this cycle (open / listed / allotment /
        // GMP jump), then the once-per-IPO "closing soon" reminders. Both are best-effort and gated
        // behind push.enabled — a push hiccup can never affect the poll outcome.
        notificationService.dispatch(changes);
        notificationService.notifyClosingSoon();

        log.info("IPO poll complete: sourcesPolled={} sourcesFailed={} rawCount={} ipoCount={}",
                sources.size(), sourcesFailed, allDtos.size(), merged.size());

        return new IpoPollResult(sources.size(), sourcesFailed, merged.size());
    }

    /** Minimal per-cycle summary, mainly for logging/admin "run now" feedback. */
    public record IpoPollResult(int sourcesPolled, int sourcesFailed, int ipoCount) {}
}
