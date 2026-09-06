package com.db.dbworld.app.ipo.notification;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.ipo.entity.IpoChangeEventEntity;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoChangeEventRepository;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.app.ipo.service.IpoStatusCanonicalizer;
import com.db.dbworld.core.push.PushService;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Turns IPO lifecycle moments into broadcast push notifications (to everyone, via the IPO topic).
 *
 * <p>Delivery is a QUEUE DRAIN, not a side effect of ingestion. {@code IpoIngestService} persists
 * every detected change as an {@code ipo_change_event} row; {@link #dispatchPending()} then picks up
 * the ones whose {@code notifiedAt} is still null and pushes them. That indirection is what makes
 * delivery independent of the poll cadence:
 * <ul>
 *   <li>a change detected OUTSIDE the IST notification window stays pending and goes out at the
 *       next in-window pass, instead of being dropped on the floor (the ingest already committed
 *       the new status, so no later poll would ever re-detect that transition);</li>
 *   <li>{@code notifiedAt} makes the drain idempotent, so it's safe to run from both the poll (for
 *       immediate delivery) and a standalone timer (to catch up) — nothing is pushed twice;</li>
 *   <li>an event older than {@link #MAX_PENDING_AGE} is retired unsent, so a long outage or a
 *       first-time deploy over an existing change history can't blast stale alerts at everyone.</li>
 * </ul>
 *
 * <p>{@link #notifyClosingSoon()} is the other half: a once-per-IPO reminder on an open IPO's IST
 * close day, deduped via {@code closingSoonNotifiedAt}. {@link #deliverPending()} runs both and is
 * what the schedulers actually call.
 *
 * <p>Every send is best-effort — a push failure is logged and never propagates (must not break a
 * poll). GMP jumps are additionally gated by {@code ipo.gmp.notify-threshold-pct} so small wiggles
 * don't spam. All delivery is gated behind {@link PushService} / {@code push.enabled}, so this is a
 * clean no-op until FCM is configured.
 */
@Log4j2
@Service
public class IpoNotificationService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final String STATUS_OPEN = "open";

    /**
     * How long a pending event stays worth announcing. Past this it's retired unsent — an alert that
     * bidding opened yesterday is noise, and this is also the guard that stops the FIRST run of the
     * drain (over a change history that predates the {@code notified_at} column, so every historical
     * row reads as pending) from broadcasting the entire archive to every device. Comfortably longer
     * than one notification window, so nothing legitimately in-flight overnight is lost.
     */
    private static final Duration MAX_PENDING_AGE = Duration.ofHours(18);

    /**
     * How many days after the real-world date an open/listing/allotment alert is still news.
     *
     * <p>{@link #MAX_PENDING_AGE} bounds how old the EVENT ROW may be, which is a different thing:
     * a row created seconds ago can still describe something that happened weeks ago. That happens
     * in bulk whenever a feed starts reporting a batch of already-settled IPOs — a local poll here
     * produced 17 "has listed" pushes in one pass for IPOs that had listed long before — so without
     * this a deploy would blast the backlog at every device. Generous enough (3 days) to cover an
     * IPO that listed on a Friday and a weekend of suppressed notification windows.
     */
    private static final int STALE_EVENT_DAYS = 3;

    private final PushService pushService;
    private final SettingsService settings;
    private final IpoListingRepository listingRepo;
    private final IpoChangeEventRepository changeEventRepo;
    private final IpoMarketCalendar marketCalendar;
    private final Clock clock;

    @Autowired
    public IpoNotificationService(PushService pushService, SettingsService settings,
                                   IpoListingRepository listingRepo, IpoChangeEventRepository changeEventRepo,
                                   IpoMarketCalendar marketCalendar) {
        this(pushService, settings, listingRepo, changeEventRepo, marketCalendar, Clock.systemUTC());
    }

    IpoNotificationService(PushService pushService, SettingsService settings, IpoListingRepository listingRepo,
                            IpoChangeEventRepository changeEventRepo, IpoMarketCalendar marketCalendar, Clock clock) {
        this.pushService = pushService;
        this.settings = settings;
        this.listingRepo = listingRepo;
        this.changeEventRepo = changeEventRepo;
        this.marketCalendar = marketCalendar;
        this.clock = clock;
    }

    /**
     * One full delivery pass: drain the pending lifecycle pushes, then the close-day reminders.
     *
     * <p>Two jobs call this — {@code ipo-live} right after its 30-minute refresh (which is what
     * detects the changes being delivered) and {@code ipo-poll} after its own ingest. The
     * scheduler's RUNNING guard is per-job, so the two CAN overlap, and both halves are
     * {@code synchronized} on this service so a read-then-stamp never interleaves — otherwise two
     * simultaneous passes could each see the same un-stamped row and push it twice. Single-node app,
     * so intrinsic locking is the whole story here.
     */
    public void deliverPending() {
        dispatchPending();
        notifyClosingSoon();
    }

    /**
     * Broadcasts every change event still awaiting delivery, oldest first, and stamps each one as
     * handled so it can never be sent twice.
     *
     * <p>The market-calendar gate is checked ONCE, before anything is stamped: outside IST market
     * hours on a trading day the whole pass is a no-op and the queue is left intact, so the alerts
     * go out at the next in-window pass rather than overnight — or never.
     */
    public synchronized void dispatchPending() {
        List<IpoChangeEventEntity> pending =
                changeEventRepo.findByEventTypeInAndNotifiedAtIsNullOrderByCreatedAtAsc(
                        IpoLifecycleChange.NOTIFIABLE_EVENT_TYPES);
        if (pending.isEmpty()) {
            return;
        }
        // Follow the Indian market calendar: never fire open/listed/allotment/GMP alerts overnight,
        // on a weekend, or on an NSE holiday. Nothing is stamped on this path, so the queue survives
        // and drains at the next in-window pass.
        if (!marketCalendar.isNotificationWindow(LocalDateTime.now(clock.withZone(IST)))) {
            log.debug("IPO notifications held for {} pending change(s) — outside the "
                    + "market-hours/trading-day window", pending.size());
            return;
        }
        Instant now = clock.instant();
        Instant tooOldBefore = now.minus(MAX_PENDING_AGE);
        Map<String, IpoListingEntity> listings = listingsFor(pending);
        int sent = 0;
        int retired = 0;
        for (IpoChangeEventEntity event : pending) {
            try {
                if (event.getCreatedAt() != null && event.getCreatedAt().isBefore(tooOldBefore)) {
                    retired++;
                } else if (deliver(event, listings.get(event.getIpoId()))) {
                    sent++;
                }
                event.setNotifiedAt(now);
                changeEventRepo.save(event);
            } catch (Exception e) {
                // Leave notifiedAt null so the next pass retries this one; the rest still go out.
                log.warn("IPO notification dispatch failed for ipoId={} eventType={}: {}",
                        event.getIpoId(), event.getEventType(), e.toString());
            }
        }
        log.info("IPO notifications: pending={} sent={} retiredAsStale={}", pending.size(), sent, retired);
    }

    /**
     * Pushes the one alert this event announces. {@code false} when there was nothing to say — the
     * event isn't a user-facing transition, its IPO has since been deleted, the underlying real-world
     * moment is old news, or a GMP move didn't clear the configured threshold — in which case the
     * caller still marks it handled.
     */
    private boolean deliver(IpoChangeEventEntity event, IpoListingEntity ipo) {
        if (ipo == null || ipo.getCompanyName() == null) {
            return false; // listing gone (deleted/purged) — nothing to name in the push
        }
        IpoLifecycleChange c = IpoLifecycleChange.fromEvent(event, ipo.getCompanyName());
        if (c == null) {
            return false;
        }
        if (!isStillNews(c.kind(), ipo)) {
            log.debug("IPO {} alert for '{}' suppressed — the event itself is older than {} days",
                    c.kind(), ipo.getCompanyName(), STALE_EVENT_DAYS);
            return false;
        }
        return switch (c.kind()) {
            case OPENED -> send(c, "🟢 " + c.companyName() + " IPO is open",
                    "Subscription is now open — tap for GMP, dates and details.");
            case LISTED -> send(c, "📈 " + c.companyName() + " has listed",
                    "See the listing price and listing gain.");
            case ALLOTMENT -> send(c, "🎉 " + c.companyName() + " allotment is out",
                    "Check your allotment status now.");
            case GMP_JUMP -> maybeSendGmp(c);
        };
    }

    /**
     * Whether the lifecycle moment this alert describes actually happened recently, judged from the
     * IPO's own dates rather than from when we noticed. A detected transition is not the same thing
     * as a fresh event: a feed can start reporting a long-settled IPO at any time, and announcing
     * "has listed" for something that listed a month ago is spam.
     *
     * <p>A missing date can't be judged, so it passes — better a rare late alert than dropping a
     * real one. GMP is a live number by definition and is always current.
     */
    private boolean isStillNews(IpoLifecycleChange.Kind kind, IpoListingEntity ipo) {
        LocalDate happenedOn = switch (kind) {
            case OPENED -> ipo.getOpenDate();
            case LISTED -> ipo.getListingDate();
            case ALLOTMENT -> ipo.getAllotmentDate();
            case GMP_JUMP -> null;
        };
        if (happenedOn == null) {
            return true;
        }
        return !happenedOn.isBefore(LocalDate.now(clock.withZone(IST)).minusDays(STALE_EVENT_DAYS));
    }

    /** The listing per IPO id referenced by {@code pending}, in one query rather than N. */
    private Map<String, IpoListingEntity> listingsFor(List<IpoChangeEventEntity> pending) {
        Set<String> ipoIds = pending.stream().map(IpoChangeEventEntity::getIpoId).collect(Collectors.toSet());
        Map<String, IpoListingEntity> byId = new HashMap<>();
        for (IpoListingEntity ipo : listingRepo.findAllById(ipoIds)) {
            byId.put(ipo.getId(), ipo);
        }
        return byId;
    }

    /**
     * Once-per-IPO "closing soon" reminder, on the IST close day itself.
     *
     * <p>Scoped to the close date and nothing earlier on purpose: the {@code closingSoonNotifiedAt}
     * marker fires this at most once ever per IPO, so a wider window meant the single reminder was
     * spent the day BEFORE close — a "last chance to apply" that wasn't, and then silence on the
     * actual final day. The close-day poll (the cadence starts at 10&nbsp;AM IST) still leaves
     * several hours before the ~5&nbsp;PM bidding cutoff enforced below.
     */
    public synchronized void notifyClosingSoon() {
        LocalDateTime nowIst = LocalDateTime.now(clock.withZone(IST));
        // Same market-calendar gate as dispatch(): no reminders overnight, on weekends, or on NSE
        // holidays — only during IST market hours on a trading day. The dedupe marker is only stamped
        // on an actual send, so a reminder suppressed now still goes out at the next in-window poll.
        if (!marketCalendar.isNotificationWindow(nowIst)) {
            return;
        }
        LocalDate today = nowIst.toLocalDate();
        // Same date twice — a single-day (inclusive) BETWEEN, reusing the existing derived query.
        List<IpoListingEntity> due = listingRepo
                .findByStatusAndCloseDateBetweenAndClosingSoonNotifiedAtIsNull(STATUS_OPEN, today, today);
        Instant now = clock.instant();
        for (IpoListingEntity ipo : due) {
            // Don't fire "last chance to apply" once bidding has actually closed (~5 PM IST on the
            // close day) — a poll after the cutoff must stay silent rather than send a dead link.
            if (IpoStatusCanonicalizer.isPastClose(ipo.getCloseDate(), nowIst)) {
                continue;
            }
            try {
                pushService.broadcast("⏳ " + ipo.getCompanyName() + " closes today",
                        "Bidding closes this evening — last chance to apply.",
                        Map.of("ipoId", ipo.getId(), "kind", "CLOSING_SOON",
                                "link", "/db-world/db-ipo/" + ipo.getId()),
                        "ipo");
                ipo.setClosingSoonNotifiedAt(now);
                listingRepo.save(ipo);
            } catch (Exception e) {
                log.warn("IPO closing-soon notification failed for ipoId={}: {}", ipo.getId(), e.toString());
            }
        }
    }

    /** GMP jump — only broadcast when the move clears the configured percentage threshold. */
    private boolean maybeSendGmp(IpoLifecycleChange c) {
        long threshold = settings.getLong(ConfigKeys.IPO_GMP_NOTIFY_THRESHOLD_PCT);
        BigDecimal oldV = parse(c.oldValue());
        BigDecimal newV = parse(c.newValue());
        if (newV == null) {
            return false; // nothing meaningful to announce
        }
        boolean significant;
        if (oldV == null || oldV.signum() == 0) {
            significant = newV.signum() != 0; // GMP just appeared / moved off zero
        } else {
            BigDecimal pct = newV.subtract(oldV).abs()
                    .multiply(BigDecimal.valueOf(100))
                    .divide(oldV.abs(), 2, RoundingMode.HALF_UP);
            significant = pct.compareTo(BigDecimal.valueOf(threshold)) >= 0;
        }
        if (!significant) {
            return false;
        }
        return send(c, "🔥 " + c.companyName() + " GMP moved",
                "Grey-market premium is now ₹" + c.newValue()
                        + (c.oldValue() != null ? " (was ₹" + c.oldValue() + ")" : "") + ".");
    }

    private boolean send(IpoLifecycleChange c, String title, String body) {
        pushService.broadcast(title, body,
                Map.of("ipoId", c.ipoId(), "kind", c.kind().name(), "link", "/db-world/db-ipo/" + c.ipoId()),
                "ipo");
        return true;
    }

    private static BigDecimal parse(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
