package com.db.dbworld.app.ipo.notification;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.core.push.PushService;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

/**
 * Turns IPO lifecycle moments into broadcast push notifications (to everyone, via the IPO topic).
 * Two entry points, both called by {@code IpoPollScheduler} after each poll:
 * <ul>
 *   <li>{@link #dispatch(List)} — the open / listed / allotment / GMP-jump changes detected during
 *       ingest. GMP jumps are gated by the {@code ipo.gmp.notify-threshold-pct} setting so small
 *       wiggles don't spam.</li>
 *   <li>{@link #notifyClosingSoon()} — a once-per-IPO reminder for open IPOs closing today/tomorrow
 *       (IST), deduped via {@code closingSoonNotifiedAt} so it fires once even though the poll runs
 *       repeatedly.</li>
 * </ul>
 * Every send is best-effort — a push failure is logged and never propagates (must not break a poll).
 * All delivery is gated behind {@link PushService} / {@code push.enabled}, so this is a clean no-op
 * until FCM is configured.
 */
@Log4j2
@Service
public class IpoNotificationService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final String STATUS_OPEN = "open";

    private final PushService pushService;
    private final SettingsService settings;
    private final IpoListingRepository listingRepo;
    private final Clock clock;

    @Autowired
    public IpoNotificationService(PushService pushService, SettingsService settings, IpoListingRepository listingRepo) {
        this(pushService, settings, listingRepo, Clock.systemUTC());
    }

    IpoNotificationService(PushService pushService, SettingsService settings, IpoListingRepository listingRepo, Clock clock) {
        this.pushService = pushService;
        this.settings = settings;
        this.listingRepo = listingRepo;
        this.clock = clock;
    }

    /** Broadcast one push per notification-worthy change from the latest ingest. */
    public void dispatch(List<IpoLifecycleChange> changes) {
        if (changes == null || changes.isEmpty()) {
            return;
        }
        for (IpoLifecycleChange c : changes) {
            try {
                switch (c.kind()) {
                    case OPENED -> send(c, "🟢 " + c.companyName() + " IPO is open",
                            "Subscription is now open — tap for GMP, dates and details.");
                    case LISTED -> send(c, "📈 " + c.companyName() + " has listed",
                            "See the listing price and listing gain.");
                    case ALLOTMENT -> send(c, "🎉 " + c.companyName() + " allotment is out",
                            "Check your allotment status now.");
                    case GMP_JUMP -> maybeSendGmp(c);
                }
            } catch (Exception e) {
                log.warn("IPO notification dispatch failed for ipoId={} kind={}: {}", c.ipoId(), c.kind(), e.toString());
            }
        }
    }

    /** Once-per-IPO "closing soon" reminder for open IPOs closing today or tomorrow (IST). */
    public void notifyClosingSoon() {
        LocalDate today = LocalDate.now(clock.withZone(IST));
        List<IpoListingEntity> due = listingRepo
                .findByStatusAndCloseDateBetweenAndClosingSoonNotifiedAtIsNull(STATUS_OPEN, today, today.plusDays(1));
        Instant now = clock.instant();
        for (IpoListingEntity ipo : due) {
            try {
                pushService.broadcast("⏳ " + ipo.getCompanyName() + " closing soon",
                        "Last chance to apply before this IPO closes.",
                        Map.of("ipoId", ipo.getId(), "kind", "CLOSING_SOON",
                                "link", "/db-world/db-ipo/" + ipo.getId()));
                ipo.setClosingSoonNotifiedAt(now);
                listingRepo.save(ipo);
            } catch (Exception e) {
                log.warn("IPO closing-soon notification failed for ipoId={}: {}", ipo.getId(), e.toString());
            }
        }
    }

    /** GMP jump — only broadcast when the move clears the configured percentage threshold. */
    private void maybeSendGmp(IpoLifecycleChange c) {
        long threshold = settings.getLong(ConfigKeys.IPO_GMP_NOTIFY_THRESHOLD_PCT);
        BigDecimal oldV = parse(c.oldValue());
        BigDecimal newV = parse(c.newValue());
        if (newV == null) {
            return; // nothing meaningful to announce
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
            return;
        }
        send(c, "🔥 " + c.companyName() + " GMP moved",
                "Grey-market premium is now ₹" + c.newValue()
                        + (c.oldValue() != null ? " (was ₹" + c.oldValue() + ")" : "") + ".");
    }

    private void send(IpoLifecycleChange c, String title, String body) {
        pushService.broadcast(title, body,
                Map.of("ipoId", c.ipoId(), "kind", c.kind().name(), "link", "/db-world/db-ipo/" + c.ipoId()));
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
