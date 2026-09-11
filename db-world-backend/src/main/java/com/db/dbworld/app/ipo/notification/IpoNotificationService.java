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
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
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
 * <h2>Volume control</h2>
 * A queue drain with no ceiling is how a single afternoon produced 28 pushes in five hours, one IPO
 * alerting five separate times. Four gates now sit between a pending event and a phone, in order:
 * <ol>
 *   <li><b>GMP pushes are off by default</b> ({@code ipo.gmp.notify-enabled}). Grey-market premium
 *       is an unofficial number that moves all day; it accounted for 20 of those 28 pushes. It is
 *       still collected, charted and displayed — only the push is gone, and the setting turns it
 *       back on for anyone who wants it.</li>
 *   <li><b>A GMP move must clear BOTH a percentage and a rupee floor</b>, measured against the last
 *       value actually announced rather than the last one polled. Relative-only was the bug: a Rs 1
 *       move on a Rs 3 GMP is a 33% jump, and comparing against the last POLL meant a drifting GMP
 *       re-cleared the threshold every pass, forever.</li>
 *   <li><b>A per-IPO cooldown</b> ({@code ipo.notify.cooldown-hours}), so one volatile issue cannot
 *       dominate the day.</li>
 *   <li><b>Bundling then a daily cap.</b> Same-kind alerts in one pass collapse into a single
 *       digest ("5 IPOs opened today") once there are {@code ipo.notify.digest-threshold} of them,
 *       and whatever survives that is capped at {@code ipo.notify.max-per-day} pushes per IST day.</li>
 * </ol>
 *
 * <p>{@link #notifyClosingSoon()} is the other half: a once-per-IPO reminder on an open IPO's IST
 * close day, deduped via {@code closingSoonNotifiedAt}. {@link #deliverPending()} runs both and is
 * what the schedulers actually call.
 *
 * <p>Every send is best-effort — a push failure is logged and never propagates (must not break a
 * poll). All delivery is gated behind {@link PushService} / {@code push.enabled}, so this is a
 * clean no-op until FCM is configured.
 */
@Log4j2
@Service
public class IpoNotificationService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final String STATUS_OPEN = "open";
    private static final String IPO_LIST_LINK = "/db-world/db-ipo";   // legacy prefix — see RequestPushLinks
    private static final String IPO_DETAIL_LINK_PREFIX = "/db-world/db-ipo/";

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

    /**
     * Order the daily cap is spent in, most consequential first. An allotment result or a listing
     * is a one-off fact a user cannot recover by opening the app later; a GMP wiggle is not. When
     * the cap bites, it has to bite the bottom of this list.
     */
    private static final List<IpoLifecycleChange.Kind> KIND_PRIORITY = List.of(
            IpoLifecycleChange.Kind.ALLOTMENT,
            IpoLifecycleChange.Kind.LISTED,
            IpoLifecycleChange.Kind.OPENED,
            IpoLifecycleChange.Kind.GMP_JUMP);

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
     * Broadcasts the change events awaiting delivery and stamps each one as handled so it can never
     * be sent twice.
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

        List<Candidate> deliverable = new ArrayList<>();
        List<IpoChangeEventEntity> handled = new ArrayList<>();
        int retired = 0;
        for (IpoChangeEventEntity event : pending) {
            if (event.getCreatedAt() != null && event.getCreatedAt().isBefore(tooOldBefore)) {
                event.setNotifiedAt(now);
                handled.add(event);
                retired++;
                continue;
            }
            Alert alert = evaluate(event, listings.get(event.getIpoId()), now);
            if (alert == null) {
                event.setNotifiedAt(now);
                handled.add(event);
                continue;
            }
            deliverable.add(new Candidate(event, alert));
        }

        int sent = 0;
        int capped = 0;
        int announced = 0;
        int budget = remainingDailyBudget(now);
        for (PlannedPush push : plan(deliverable)) {
            if (budget <= 0) {
                push.members().forEach(c -> c.event().setNotifiedAt(now));
                push.members().forEach(c -> handled.add(c.event()));
                capped += push.members().size();
                continue;
            }
            // Each push gets its own instant so the daily cap can count NOTIFICATIONS (distinct
            // pushedAt values) rather than events — one digest covering five IPOs must spend one
            // unit of the cap, not five.
            Instant pushedAt = now.plusMillis(sent);
            try {
                pushService.broadcast(push.title(), push.body(), push.data(), push.channelId());
            } catch (Exception e) {
                // Leave notifiedAt null so the next pass retries these; the rest still go out.
                log.warn("IPO notification dispatch failed for {} ({} event(s)): {}",
                        push.kind(), push.members().size(), e.toString());
                continue;
            }
            for (Candidate c : push.members()) {
                c.event().setNotifiedAt(now);
                c.event().setPushedAt(pushedAt);
                handled.add(c.event());
            }
            budget--;
            sent++;
            announced += push.members().size();
        }
        changeEventRepo.saveAll(handled);
        log.info("IPO notifications: pending={} pushesSent={} eventsAnnounced={} retiredAsStale={} "
                        + "suppressed={} droppedByDailyCap={}",
                pending.size(), sent, announced, retired,
                pending.size() - deliverable.size() - retired, capped);
    }

    /**
     * The alert this event should produce, or {@code null} when it should be handled silently —
     * the event isn't a user-facing transition, its IPO has since been deleted, the underlying
     * real-world moment is old news, a GMP move didn't clear its thresholds, or this IPO is still
     * inside its cooldown.
     */
    private Alert evaluate(IpoChangeEventEntity event, IpoListingEntity ipo, Instant now) {
        if (ipo == null || ipo.getCompanyName() == null) {
            return null; // listing gone (deleted/purged) — nothing to name in the push
        }
        IpoLifecycleChange c = IpoLifecycleChange.fromEvent(event, ipo.getCompanyName());
        if (c == null) {
            return null;
        }
        if (!isStillNews(c.kind(), ipo)) {
            log.debug("IPO {} alert for '{}' suppressed — the event itself is older than {} days",
                    c.kind(), ipo.getCompanyName(), STALE_EVENT_DAYS);
            return null;
        }
        if (c.kind() == IpoLifecycleChange.Kind.GMP_JUMP && !gmpWorthAnnouncing(c)) {
            return null;
        }
        if (withinCooldown(event, now)) {
            log.debug("IPO {} alert for '{}' suppressed — inside the per-IPO cooldown",
                    c.kind(), ipo.getCompanyName());
            return null;
        }
        return switch (c.kind()) {
            case OPENED -> new Alert(c, "🟢 " + c.companyName() + " IPO is open",
                    "Subscription is now open — tap for GMP, dates and details.");
            case LISTED -> new Alert(c, "📈 " + c.companyName() + " has listed",
                    "See the listing price and listing gain.");
            case ALLOTMENT -> new Alert(c, "🎉 " + c.companyName() + " allotment is out",
                    "Check your allotment status now.");
            case GMP_JUMP -> new Alert(c, "🔥 " + c.companyName() + " GMP moved",
                    "Grey-market premium is now ₹" + c.newValue()
                            + (c.oldValue() != null ? " (was ₹" + c.oldValue() + ")" : "") + ".");
        };
    }

    /**
     * Whether a GMP move is worth a notification.
     *
     * <p>Off entirely by default, and when on it must clear BOTH a rupee floor and a percentage,
     * measured against the last GMP actually ANNOUNCED. Each of those three is a distinct fix:
     * without the master switch, GMP was two thirds of all traffic; without the rupee floor, a Rs 1
     * move on a Rs 3 GMP reads as a 33% jump; and comparing against the last POLLED value (which is
     * what the change event carries in {@code oldValue}) let a GMP drifting a few percent per pass
     * re-clear the threshold every single pass, which is exactly what alerted one IPO four times in
     * three and a half hours.
     */
    private boolean gmpWorthAnnouncing(IpoLifecycleChange c) {
        if (!settings.getBoolean(ConfigKeys.IPO_GMP_NOTIFY_ENABLED)) {
            return false;
        }
        BigDecimal newV = parse(c.newValue());
        if (newV == null) {
            return false; // nothing meaningful to announce
        }
        BigDecimal minAbsolute = BigDecimal.valueOf(settings.getLong(ConfigKeys.IPO_GMP_NOTIFY_MIN_ABSOLUTE));
        BigDecimal baseline = lastAnnouncedGmp(c.ipoId());
        if (baseline == null) {
            baseline = parse(c.oldValue());
        }
        if (baseline == null || baseline.signum() == 0) {
            // GMP just appeared or moved off zero: there is no percentage to measure, so the rupee
            // floor is the only guard — and it still has to apply, or every IPO that ticks off zero
            // by a rupee gets a push.
            return newV.abs().compareTo(minAbsolute) >= 0;
        }
        BigDecimal delta = newV.subtract(baseline).abs();
        if (delta.compareTo(minAbsolute) < 0) {
            return false;
        }
        BigDecimal pct = delta.multiply(BigDecimal.valueOf(100)).divide(baseline.abs(), 2, RoundingMode.HALF_UP);
        return pct.compareTo(BigDecimal.valueOf(settings.getLong(ConfigKeys.IPO_GMP_NOTIFY_THRESHOLD_PCT))) >= 0;
    }

    /** The GMP value carried by the most recent GMP push we actually delivered for this IPO. */
    private BigDecimal lastAnnouncedGmp(String ipoId) {
        return changeEventRepo.findRecentPushed(ipoId, "GMP", Limit.of(1)).stream()
                .map(IpoChangeEventEntity::getNewValue)
                .map(IpoNotificationService::parse)
                .findFirst()
                .orElse(null);
    }

    /**
     * Whether this IPO has already been pushed about, for this event type, too recently.
     *
     * <p>Keyed on the stored event type rather than the lifecycle kind, which folds OPENED and
     * LISTED together under {@code STATUS}. That is harmless in practice — an IPO lists roughly a
     * week after it opens, far outside any sane cooldown — and it keeps the check to one indexed
     * row read.
     */
    private boolean withinCooldown(IpoChangeEventEntity event, Instant now) {
        long hours = settings.getLong(ConfigKeys.IPO_NOTIFY_COOLDOWN_HOURS);
        if (hours <= 0) {
            return false;
        }
        Instant since = now.minus(Duration.ofHours(hours));
        return changeEventRepo.findRecentPushed(event.getIpoId(), event.getEventType(), Limit.of(1)).stream()
                .map(IpoChangeEventEntity::getPushedAt)
                .anyMatch(pushedAt -> pushedAt != null && pushedAt.isAfter(since));
    }

    /**
     * How many same-kind alerts it takes to bundle. Floored at 2 regardless of configuration: a
     * threshold of 0 or 1 would turn a lone alert into a digest reading "1 IPOs opened today",
     * which is both wrong and strictly worse than the single push it replaced.
     */
    private long digestThreshold() {
        return Math.max(2L, settings.getLong(ConfigKeys.IPO_NOTIFY_DIGEST_THRESHOLD));
    }

    /** Pushes still allowed today, or {@link Integer#MAX_VALUE} when the cap is disabled. */
    private int remainingDailyBudget(Instant now) {
        long max = settings.getLong(ConfigKeys.IPO_NOTIFY_MAX_PER_DAY);
        if (max <= 0) {
            return Integer.MAX_VALUE;
        }
        Instant startOfIstDay = LocalDate.now(clock.withZone(IST)).atStartOfDay(IST).toInstant();
        long alreadySent = changeEventRepo.countPushesSince(startOfIstDay);
        return (int) Math.max(0, max - alreadySent);
    }

    /**
     * Turns the surviving candidates into the actual list of pushes, most consequential kind first.
     *
     * <p>Two collapses happen here. Repeat candidates for the same IPO and kind are reduced to the
     * newest — a queue holding two GMP events for one company must not produce two lines about it.
     * Then each kind with at least {@code ipo.notify.digest-threshold} candidates becomes a single
     * summary push instead of one push each; that alone turns the observed worst pass (seven "GMP
     * moved" pushes half a second apart) into one notification.
     */
    private List<PlannedPush> plan(List<Candidate> deliverable) {
        Map<IpoLifecycleChange.Kind, Map<String, Candidate>> byKind = new EnumMap<>(IpoLifecycleChange.Kind.class);
        for (Candidate candidate : deliverable) {
            byKind.computeIfAbsent(candidate.alert().change().kind(), k -> new LinkedHashMap<>())
                    .put(candidate.alert().change().ipoId(), candidate);   // newest wins per (ipo, kind)
        }
        long digestThreshold = digestThreshold();

        List<PlannedPush> plan = new ArrayList<>();
        for (IpoLifecycleChange.Kind kind : KIND_PRIORITY) {
            List<Candidate> group = new ArrayList<>(byKind.getOrDefault(kind, Map.of()).values());
            if (group.isEmpty()) {
                continue;
            }
            if (group.size() >= digestThreshold) {
                plan.add(digestPush(kind, group));
            } else {
                group.forEach(c -> plan.add(singlePush(kind, c)));
            }
        }
        return plan;
    }

    private PlannedPush singlePush(IpoLifecycleChange.Kind kind, Candidate candidate) {
        IpoLifecycleChange c = candidate.alert().change();
        return new PlannedPush(kind, candidate.alert().title(), candidate.alert().body(),
                Map.of("ipoId", c.ipoId(), "kind", kind.name(), "link", IPO_DETAIL_LINK_PREFIX + c.ipoId()),
                channelFor(kind), List.of(candidate));
    }

    private PlannedPush digestPush(IpoLifecycleChange.Kind kind, List<Candidate> group) {
        int count = group.size();
        String title = switch (kind) {
            case OPENED -> "🟢 " + count + " IPOs opened today";
            case LISTED -> "📈 " + count + " IPOs listed today";
            case ALLOTMENT -> "🎉 Allotment is out for " + count + " IPOs";
            case GMP_JUMP -> "🔥 GMP moved on " + count + " IPOs";
        };
        return new PlannedPush(kind, title, namesSentence(group) + " — tap to see them all.",
                Map.of("kind", kind.name(), "count", String.valueOf(count), "link", IPO_LIST_LINK),
                channelFor(kind), group);
    }

    /** "A, B and 3 more" — enough to recognise the digest without overrunning a notification shade. */
    private static String namesSentence(List<Candidate> group) {
        List<String> names = group.stream()
                .map(c -> c.alert().change().companyName())
                .sorted(Comparator.naturalOrder())
                .toList();
        int shown = Math.min(2, names.size());
        String head = String.join(", ", names.subList(0, shown));
        int remaining = names.size() - shown;
        return remaining == 0 ? head : head + " and " + remaining + " more";
    }

    /**
     * Android notification channel. GMP gets its own so it can be muted at OS level without also
     * losing allotment and listing alerts — the single shared "ipo" channel made those all-or-nothing.
     */
    private static String channelFor(IpoLifecycleChange.Kind kind) {
        return kind == IpoLifecycleChange.Kind.GMP_JUMP ? "ipo-gmp" : "ipo";
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
     *
     * <p>Bundled the same way as the change-event drain: three IPOs closing on the same day is
     * three separate reminders that say the same thing, so past the digest threshold they become
     * one. Not subject to the daily cap — this is the single most actionable alert the app sends
     * (it is the last moment a user can act at all), and it fires at most once per IPO ever.
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
        // Don't fire "last chance to apply" once bidding has actually closed (~5 PM IST on the
        // close day) — a poll after the cutoff must stay silent rather than send a dead link.
        List<IpoListingEntity> stillOpen = due.stream()
                .filter(ipo -> !IpoStatusCanonicalizer.isPastClose(ipo.getCloseDate(), nowIst))
                .toList();
        if (stillOpen.isEmpty()) {
            return;
        }
        Instant now = clock.instant();
        try {
            if (stillOpen.size() >= digestThreshold()) {
                String names = stillOpen.stream()
                        .map(IpoListingEntity::getCompanyName)
                        .sorted(Comparator.naturalOrder())
                        .limit(2)
                        .collect(Collectors.joining(", "));
                int remaining = stillOpen.size() - Math.min(2, stillOpen.size());
                pushService.broadcast("⏳ " + stillOpen.size() + " IPOs close today",
                        (remaining == 0 ? names : names + " and " + remaining + " more")
                                + " — bidding closes this evening.",
                        Map.of("kind", "CLOSING_SOON", "count", String.valueOf(stillOpen.size()),
                                "link", IPO_LIST_LINK),
                        "ipo");
            } else {
                for (IpoListingEntity ipo : stillOpen) {
                    pushService.broadcast("⏳ " + ipo.getCompanyName() + " closes today",
                            "Bidding closes this evening — last chance to apply.",
                            Map.of("ipoId", ipo.getId(), "kind", "CLOSING_SOON",
                                    "link", IPO_DETAIL_LINK_PREFIX + ipo.getId()),
                            "ipo");
                }
            }
        } catch (Exception e) {
            // Nothing is stamped below on this path, so every reminder in this batch stays due and
            // is retried at the next in-window pass.
            log.warn("IPO closing-soon notification failed for {} IPO(s): {}", stillOpen.size(), e.toString());
            return;
        }
        stillOpen.forEach(ipo -> ipo.setClosingSoonNotifiedAt(now));
        listingRepo.saveAll(stillOpen);
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

    /** A pending event that survived every suppression gate, paired with the copy it produced. */
    private record Candidate(IpoChangeEventEntity event, Alert alert) {}

    /** One event's push copy, before bundling decides whether it is sent on its own. */
    private record Alert(IpoLifecycleChange change, String title, String body) {}

    /** One notification as it will actually be sent, and the events it accounts for. */
    private record PlannedPush(IpoLifecycleChange.Kind kind, String title, String body,
                               Map<String, String> data, String channelId, List<Candidate> members) {}
}
