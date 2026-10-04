package com.db.dbworld.app.system.health.alert;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.system.health.HostHealthService;
import com.db.dbworld.app.system.health.alert.HostHealthAlertPolicy.Alert;
import com.db.dbworld.app.system.health.alert.HostHealthAlertPolicy.Outcome;
import com.db.dbworld.app.system.health.alert.HostHealthAlertPolicy.Settings;
import com.db.dbworld.app.system.health.alert.HostHealthAlertPolicy.State;
import com.db.dbworld.core.push.PushService;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Re-reads the host health report every five minutes and pushes what changed to admin phones.
 *
 * <p>Which changes count is {@link HostHealthAlertPolicy}'s decision; this class only supplies the
 * inputs, keeps the state between runs and sends the result.
 *
 * <p>The state lives in memory only. After a restart the first run sees every current failure as
 * new and announces it once more; that is one extra push per deploy at worst, and much simpler
 * than persisting alert state for a job this light.
 */
@Log4j2
@Component
public class HostHealthMonitor {

    /**
     * Opens the admin System Info page, where the Host health section is. The route key matches
     * the other admin pushes ({@code admin/ingestion}, {@code admin/requests}). The link is there
     * for app builds that predate the key: they resolve a full {@code link} directly and would
     * otherwise drop the admin on the home page. It carries the legacy {@code /db-world} prefix for
     * the reason {@code RequestPushLinks} gives: that form resolves on old and new builds alike.
     */
    static final Map<String, String> DEEP_LINK = Map.of(
            "route", "admin/system-info",
            "link", "/db-world/admin/system-info");

    /** The Android notification channel admin alerts already use. */
    static final String CHANNEL = "admin";

    private final HostHealthService healthService;
    private final HostHealthAlertPolicy policy;
    private final SettingsService settings;
    private final PushService pushService;
    private final Clock clock;

    private final AtomicReference<State> state = new AtomicReference<>(State.INITIAL);

    @Autowired
    public HostHealthMonitor(HostHealthService healthService, HostHealthAlertPolicy policy,
                             SettingsService settings, PushService pushService) {
        this(healthService, policy, settings, pushService, Clock.systemUTC());
    }

    HostHealthMonitor(HostHealthService healthService, HostHealthAlertPolicy policy,
                      SettingsService settings, PushService pushService, Clock clock) {
        this.healthService = healthService;
        this.policy = policy;
        this.settings = settings;
        this.pushService = pushService;
        this.clock = clock;
    }

    /**
     * A third of the doctor's 15-minute cadence, so a new report is noticed within five minutes
     * of being written. The first run waits a minute so a quick restart loop does not push.
     */
    @Scheduled(initialDelay = 60_000L, fixedDelay = 300_000L)
    public void check() {
        try {
            Settings current = new Settings(
                    settings.getBoolean(ConfigKeys.SYSTEM_HEALTH_ALERTS_ENABLED),
                    settings.getBoolean(ConfigKeys.SYSTEM_HEALTH_ALERT_ON_WARN));
            Outcome outcome = policy.evaluate(state.get(), healthService.read(), current, Instant.now(clock));
            state.set(outcome.next());
            outcome.alerts().forEach(this::send);
        } catch (Exception e) {
            // A scheduled method that throws is retried on the next tick anyway; the log line is
            // what makes the failure visible.
            log.warn("Host health alert check failed: {}", e.toString());
        }
    }

    /** The alert state as of the last run, for tests. */
    State state() {
        return state.get();
    }

    private void send(Alert alert) {
        try {
            // Logged as an alert, not a delivery: broadcastToAdmins skips quietly when push.enabled
            // is off, and the log should still show what would have gone out.
            log.info("Host health alert [{}] {}: {}", alert.kind(), alert.title(), alert.body());
            pushService.broadcastToAdmins(alert.title(), alert.body(), DEEP_LINK, CHANNEL);
        } catch (Exception e) {
            log.warn("Host health push '{}' failed: {}", alert.title(), e.toString());
        }
    }
}
