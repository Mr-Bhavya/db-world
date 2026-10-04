package com.db.dbworld.app.system.health.alert;

import com.db.dbworld.app.system.health.HostHealthStatus;
import com.db.dbworld.app.system.health.dto.HostHealthReport;
import com.db.dbworld.app.system.health.dto.HostHealthReport.Check;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Decides which host health changes are worth a phone notification.
 *
 * <p>Pure: it takes the previous alert state, the latest report, the settings and the time, and
 * returns the next state plus the pushes to send. It holds nothing between calls, so every rule
 * below can be tested by feeding it reports, and the caller owns where the state lives.
 *
 * <p>The doctor rewrites the whole report every 15 minutes and this runs every 5, so the same
 * failure is seen dozens of times a day. Pushing on every sighting would bury the one message
 * that matters, so only changes notify:
 * <ul>
 *   <li>a check entering {@code fail} (or {@code warn}, when that is switched on);</li>
 *   <li>a failing check recovering, as "Resolved";</li>
 *   <li>a reminder every 24 hours while a check stays failing, so a long outage is not forgotten;</li>
 *   <li>the report going stale or disappearing after it had been seen, and coming back.</li>
 * </ul>
 */
@Component
public class HostHealthAlertPolicy {

    /** How long a check can stay failing before it is mentioned again. */
    static final Duration REMINDER_EVERY = Duration.ofHours(24);

    /**
     * More check alerts than this in one pass are folded into a single push. A cascade is common:
     * an unplugged media disk fails its space check, its SMART check and the backup that lives on
     * it all at once, and five separate buzzes say nothing one summary would not.
     */
    static final int MAX_SEPARATE_CHECK_ALERTS = 3;

    /** The two admin settings that shape alerting. */
    public record Settings(boolean alertsEnabled, boolean alertOnWarn) {}

    /**
     * A check that has been alerted on and not yet resolved.
     *
     * @param since          when it entered its current alert level, for "failing for 2 days"
     * @param lastNotifiedAt when a push last went out about it, which the reminder counts from
     */
    public record Active(String name, HostHealthStatus status, Instant since, Instant lastNotifiedAt) {}

    /**
     * What has been announced so far.
     *
     * @param reportSeen      a report has been read since startup; a dev box never sets this, so
     *                        it never hears that a report it never had has "stopped"
     * @param silenceNotified "stopped reporting" has gone out and "reporting again" has not
     * @param active          alerting checks by id
     */
    public record State(boolean reportSeen, boolean silenceNotified, Map<String, Active> active) {
        public static final State INITIAL = new State(false, false, Map.of());

        public State {
            active = Map.copyOf(active);
        }
    }

    public enum Kind { CHECK_FAILING, CHECK_WARNING, CHECK_REMINDER, CHECK_RESOLVED, DIGEST, REPORT_SILENT, REPORT_RESUMED }

    /** One push to send. {@code checkId} and {@code checkName} are null for report-level alerts. */
    public record Alert(Kind kind, String checkId, String checkName, String title, String body) {}

    public record Outcome(State next, List<Alert> alerts) {}

    public Outcome evaluate(State previous, HostHealthReport report, Settings settings, Instant now) {
        State prev = previous == null ? State.INITIAL : previous;

        // Off means off, and forgetting is deliberate: switching alerts back on should announce
        // whatever is failing at that moment, not stay quiet because it was failing before.
        if (!settings.alertsEnabled()) return new Outcome(State.INITIAL, List.of());

        if (report == null || !report.available() || report.stale()) {
            return whenSilent(prev, report);
        }

        List<Alert> alerts = new ArrayList<>();
        if (prev.silenceNotified()) alerts.add(resumed(report));

        Map<String, Active> next = new LinkedHashMap<>();
        List<Alert> checkAlerts = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Check check : report.checks()) {
            // Ids are unique by contract; if a doctor bug repeats one, the first sighting wins
            // rather than the two copies fighting over one alert.
            if (!seen.add(check.id())) continue;
            evaluateCheck(check, prev.active().get(check.id()), settings, now, next, checkAlerts);
        }
        // A check that vanished from the report (renamed, or dropped from the doctor) is forgotten
        // without a "Resolved": nothing says it was fixed.

        alerts.addAll(checkAlerts.size() > MAX_SEPARATE_CHECK_ALERTS ? List.of(digest(checkAlerts)) : checkAlerts);
        return new Outcome(new State(true, false, next), List.copyOf(alerts));
    }

    private static void evaluateCheck(Check check, Active was, Settings settings, Instant now,
                                      Map<String, Active> next, List<Alert> out) {
        HostHealthStatus status = HostHealthStatus.parse(check.status());
        boolean alertable = status == HostHealthStatus.FAIL
                || (status == HostHealthStatus.WARN && settings.alertOnWarn());

        if (alertable) {
            if (was == null || was.status() != status) {
                out.add(entered(check, status));
                next.put(check.id(), new Active(check.name(), status, now, now));
            } else if (status == HostHealthStatus.FAIL && !now.isBefore(was.lastNotifiedAt().plus(REMINDER_EVERY))) {
                out.add(reminder(check, was, now));
                next.put(check.id(), new Active(check.name(), status, was.since(), now));
            } else {
                next.put(check.id(), was);
            }
            return;
        }

        if (was == null) return;

        if (status == HostHealthStatus.OK
                || (status == HostHealthStatus.WARN && was.status() == HostHealthStatus.FAIL)) {
            out.add(resolved(check, status));
        } else if (status == HostHealthStatus.UNKNOWN) {
            // The doctor could not tell this time. That is not a recovery, so keep the alert:
            // if it comes back failing it is not news, and if it comes back ok it gets its
            // "Resolved". No reminders while it is unknown, though; nothing says it still fails.
            next.put(check.id(), was);
        }
        // Otherwise it was alerting as a warning and warning alerts have since been switched off.
        // Saying "Resolved" would be false, so it is dropped quietly.
    }

    private static Outcome whenSilent(State prev, HostHealthReport report) {
        // A stale file was still read, so it counts as seen: a restart while the timer is broken
        // must still say so. A missing file only matters if one was there before.
        boolean seen = prev.reportSeen() || (report != null && report.available());
        if (!seen || prev.silenceNotified()) {
            return new Outcome(new State(seen, prev.silenceNotified(), prev.active()), List.of());
        }
        // Check alerts are kept as they were. Their state is unknown while blind, so there are no
        // reminders or resolutions until a fresh report arrives.
        return new Outcome(new State(true, true, prev.active()), List.of(silent(report)));
    }

    // ── Message text ─────────────────────────────────────────────────────────

    private static Alert entered(Check check, HostHealthStatus status) {
        return status == HostHealthStatus.FAIL
                ? new Alert(Kind.CHECK_FAILING, check.id(), check.name(), "Pi: " + check.name(), describe(check))
                : new Alert(Kind.CHECK_WARNING, check.id(), check.name(), "Pi warning: " + check.name(), describe(check));
    }

    private static Alert reminder(Check check, Active was, Instant now) {
        return new Alert(Kind.CHECK_REMINDER, check.id(), check.name(), "Still failing: " + check.name(),
                "Failing for " + humanDuration(Duration.between(was.since(), now)) + ". " + describe(check));
    }

    private static Alert resolved(Check check, HostHealthStatus status) {
        String body = status == HostHealthStatus.WARN
                ? "Down to a warning" + suffix(check.value())
                : "Back to normal" + suffix(check.value());
        return new Alert(Kind.CHECK_RESOLVED, check.id(), check.name(), "Resolved: " + check.name(), body);
    }

    private static Alert silent(HostHealthReport report) {
        String body;
        if (report != null && report.available() && report.ageSeconds() != null && report.intervalSeconds() != null) {
            String host = report.host() == null || report.host().isBlank() ? "the Pi" : report.host();
            body = "The last report from " + host + " is " + humanDuration(Duration.ofSeconds(report.ageSeconds()))
                    + " old; it should refresh every " + humanDuration(Duration.ofSeconds(report.intervalSeconds())) + ".";
        } else {
            String reason = report == null || report.reason() == null ? "" : " " + report.reason();
            body = "The host health report can no longer be read." + reason;
        }
        return new Alert(Kind.REPORT_SILENT, null, null, "Health checks stopped reporting", body);
    }

    private static Alert resumed(HostHealthReport report) {
        HostHealthReport.Counts c = report.counts();
        String body = "Overall " + report.overall() + ": " + c.fail() + " failing, " + c.warn() + " warning, "
                + c.ok() + " ok.";
        return new Alert(Kind.REPORT_RESUMED, null, null, "Health checks reporting again", body);
    }

    private static Alert digest(List<Alert> alerts) {
        Map<Kind, String> byKind = alerts.stream().collect(Collectors.groupingBy(
                Alert::kind, LinkedHashMap::new, Collectors.mapping(Alert::checkName, Collectors.joining(", "))));
        List<String> parts = new ArrayList<>();
        appendPart(parts, "Failing", byKind.get(Kind.CHECK_FAILING));
        appendPart(parts, "Warning", byKind.get(Kind.CHECK_WARNING));
        appendPart(parts, "Still failing", byKind.get(Kind.CHECK_REMINDER));
        appendPart(parts, "Resolved", byKind.get(Kind.CHECK_RESOLVED));
        return new Alert(Kind.DIGEST, null, null, "Pi: " + alerts.size() + " health alerts", String.join(" ", parts));
    }

    private static void appendPart(List<String> parts, String label, String names) {
        if (names != null && !names.isEmpty()) parts.add(label + ": " + names + ".");
    }

    /** The check's value and the fix to try, as one line for a notification body. */
    private static String describe(Check check) {
        String what = !check.value().isBlank() ? check.value()
                : !check.detail().isBlank() ? check.detail()
                : "Status " + check.status();
        return check.hint().isBlank() ? what : what + " — " + check.hint();
    }

    private static String suffix(String value) {
        return value == null || value.isBlank() ? "." : ": " + value;
    }

    /** Coarse on purpose: a phone notification wants "3 h", not "3 h 12 min 5 s". */
    static String humanDuration(Duration d) {
        long minutes = Math.max(0, d.toMinutes());
        if (minutes < 60) return minutes + " min";
        long hours = d.toHours();
        if (hours < 48) return hours + " h";
        return d.toDays() + " days";
    }
}
