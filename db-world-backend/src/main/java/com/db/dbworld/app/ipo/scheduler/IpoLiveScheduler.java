package com.db.dbworld.app.ipo.scheduler;

import com.db.dbworld.app.ipo.notification.IpoNotificationService;
import com.db.dbworld.app.ipo.service.InvestorgainLiveService;

import lombok.extern.log4j.Log4j2;

import org.springframework.stereotype.Component;

/**
 * The LIVE tier of the IPO pipeline: refreshes the fast-moving numbers, then delivers whatever
 * notifications that produced.
 *
 * <p>Split from {@link IpoPollScheduler} because the two have completely different costs. A poll
 * cycle is dozens of HTTP calls (NSE's bootstrap dance, Chittorgarh's paged list plus per-IPO detail
 * pages, the day-wise GMP/subscription series), which is why it runs every couple of hours. This is
 * two calls plus a handful of conditional ones, all covering every current IPO at once, so it can
 * run every half hour and the numbers on the card actually read as live.
 *
 * <p><b>Refresh then deliver, in that order, in one job.</b> These were briefly two separate
 * schedulers and that was a mistake: the refresh is what detects a GMP move, so running delivery on
 * its own cron meant an alert could sit in the queue until the next tick for no reason. Same tick,
 * right order, one fewer job to reason about — and the delivery pass is idempotent
 * ({@code notified_at}) and cheap when idle, so pairing them costs nothing.
 *
 * <p>Driven by the {@code ipo-live} entry in {@code scheduler_job_config} (default: every 30 minutes
 * across the 10:00–21:00 IST window), so the cadence is editable on the admin Scheduler page and it
 * gets the usual run-now / history / enable-disable treatment.
 */
@Log4j2
@Component
public class IpoLiveScheduler {

    /** Scheduler job id used in scheduler_job_config (mirrors {@link IpoPollScheduler#JOB_ID}). */
    public static final String JOB_ID = "ipo-live";

    private final InvestorgainLiveService liveService;
    private final IpoNotificationService notificationService;

    public IpoLiveScheduler(InvestorgainLiveService liveService, IpoNotificationService notificationService) {
        this.liveService = liveService;
        this.notificationService = notificationService;
    }

    /**
     * One live cycle. Both halves are self-guarded and never throw, so a bad upstream response can
     * neither fail the job nor stop the other half from running.
     */
    public void refreshOnce() {
        liveService.refresh();
        notificationService.deliverPending();
    }
}
