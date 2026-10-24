package com.db.dbworld.app.system.health.alert;

import com.db.dbworld.app.system.health.HostHealthStatus;
import com.db.dbworld.app.system.health.alert.HostHealthAlertPolicy.Alert;
import com.db.dbworld.app.system.health.alert.HostHealthAlertPolicy.Kind;
import com.db.dbworld.app.system.health.alert.HostHealthAlertPolicy.Outcome;
import com.db.dbworld.app.system.health.alert.HostHealthAlertPolicy.Settings;
import com.db.dbworld.app.system.health.alert.HostHealthAlertPolicy.State;
import com.db.dbworld.app.system.health.dto.HostHealthReport;
import com.db.dbworld.app.system.health.dto.HostHealthReport.Check;
import com.db.dbworld.app.system.health.dto.HostHealthReport.Counts;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class HostHealthAlertPolicyTest {

    private static final Settings DEFAULTS = new Settings(true, false);
    private static final Settings WITH_WARN = new Settings(true, true);
    private static final Settings DISABLED = new Settings(false, false);

    private static final Instant T0 = Instant.parse("2026-10-04T11:15:00Z");

    private final HostHealthAlertPolicy policy = new HostHealthAlertPolicy();

    // ── Fixtures ─────────────────────────────────────────────────────────────

    private static Check check(String id, String status) {
        return new Check(id, "Disks", "Check " + id, status, id + " value", "", "");
    }

    private static Check diskRoot(String status, String value) {
        return new Check("disk.root", "Disks", "System disk space", status, value, "", "sudo dbworldctl cleanup");
    }

    private static HostHealthReport fresh(Check... checks) {
        return new HostHealthReport(true, null, false, 60L, "/var/lib/dbworld/health/doctor.json",
                1, "dbworldpi", "2026-10-04T16:45:00+05:30", 1_791_112_500L, 900L, "ok",
                new Counts(1, 0, 0, 0), List.of(checks));
    }

    private static HostHealthReport stale() {
        return new HostHealthReport(true, null, true, 3_600L, "/var/lib/dbworld/health/doctor.json",
                1, "dbworldpi", "2026-10-04T16:45:00+05:30", 1_791_112_500L, 900L, "ok",
                new Counts(1, 0, 0, 0), List.of(check("disk.root", "ok")));
    }

    private static HostHealthReport missing() {
        return HostHealthReport.unavailable("/var/lib/dbworld/health/doctor.json",
                "No health report at /var/lib/dbworld/health/doctor.json.");
    }

    /** Runs the policy over a sequence of (report, time) steps from a clean start. */
    private final class Run {
        State state = State.INITIAL;
        Settings settings = DEFAULTS;

        List<Alert> at(Instant now, HostHealthReport report) {
            Outcome outcome = policy.evaluate(state, report, settings, now);
            state = outcome.next();
            return outcome.alerts();
        }
    }

    // ── Entering and staying in fail ─────────────────────────────────────────

    @Test
    void checkEnteringFail_pushesOnce_withNameValueAndHint() {
        Run run = new Run();
        run.at(T0, fresh(diskRoot("ok", "40% used")));

        List<Alert> alerts = run.at(T0.plusSeconds(300), fresh(diskRoot("fail", "97% used, 0.4 GB free")));

        assertThat(alerts).singleElement().satisfies(a -> {
            assertThat(a.kind()).isEqualTo(Kind.CHECK_FAILING);
            assertThat(a.checkId()).isEqualTo("disk.root");
            assertThat(a.title()).isEqualTo("Pi: System disk space");
            assertThat(a.body()).isEqualTo("97% used, 0.4 GB free — sudo dbworldctl cleanup");
        });
    }

    @Test
    void stillFailingWithin24h_pushesNothing() {
        Run run = new Run();
        run.at(T0, fresh(diskRoot("fail", "97% used")));

        assertThat(run.at(T0.plus(Duration.ofMinutes(5)), fresh(diskRoot("fail", "97% used")))).isEmpty();
        assertThat(run.at(T0.plus(Duration.ofHours(23).plusMinutes(55)), fresh(diskRoot("fail", "98% used")))).isEmpty();
    }

    @Test
    void stillFailingAfter24h_remindsOnce_thenWaitsAnother24h() {
        Run run = new Run();
        run.at(T0, fresh(diskRoot("fail", "97% used")));

        List<Alert> reminder = run.at(T0.plus(Duration.ofHours(24)), fresh(diskRoot("fail", "98% used")));
        assertThat(reminder).singleElement().satisfies(a -> {
            assertThat(a.kind()).isEqualTo(Kind.CHECK_REMINDER);
            assertThat(a.title()).isEqualTo("Still failing: System disk space");
            assertThat(a.body()).startsWith("Failing for 24 h. 98% used");
        });

        // The reminder restarts the clock; the original start time is kept for the wording.
        assertThat(run.at(T0.plus(Duration.ofHours(30)), fresh(diskRoot("fail", "98% used")))).isEmpty();
        List<Alert> second = run.at(T0.plus(Duration.ofHours(48)), fresh(diskRoot("fail", "99% used")));
        assertThat(second).singleElement().satisfies(a -> assertThat(a.body()).startsWith("Failing for 2 days."));
    }

    @Test
    void firstReportAfterStartup_announcesCurrentFailures() {
        // In-memory state: a restart forgets what was announced, so the first run says it again.
        Run run = new Run();

        assertThat(run.at(T0, fresh(diskRoot("fail", "97% used"), check("hw.temp", "ok"))))
                .extracting(Alert::kind).containsExactly(Kind.CHECK_FAILING);
    }

    // ── Recovery ─────────────────────────────────────────────────────────────

    @Test
    void failingCheckRecoveringToOk_pushesResolved_once() {
        Run run = new Run();
        run.at(T0, fresh(diskRoot("fail", "97% used")));

        List<Alert> alerts = run.at(T0.plusSeconds(300), fresh(diskRoot("ok", "61% used")));

        assertThat(alerts).singleElement().satisfies(a -> {
            assertThat(a.kind()).isEqualTo(Kind.CHECK_RESOLVED);
            assertThat(a.title()).isEqualTo("Resolved: System disk space");
            assertThat(a.body()).isEqualTo("Back to normal: 61% used");
        });
        assertThat(run.at(T0.plusSeconds(600), fresh(diskRoot("ok", "61% used")))).isEmpty();
        assertThat(run.state.active()).isEmpty();
    }

    @Test
    void failingCheckRecoveringToWarn_alsoCountsAsResolved() {
        Run run = new Run();
        run.at(T0, fresh(diskRoot("fail", "97% used")));

        assertThat(run.at(T0.plusSeconds(300), fresh(diskRoot("warn", "86% used"))))
                .singleElement().satisfies(a -> {
                    assertThat(a.kind()).isEqualTo(Kind.CHECK_RESOLVED);
                    assertThat(a.body()).isEqualTo("Down to a warning: 86% used");
                });
    }

    @Test
    void failingCheckTurningUnknown_isNotAResolution() {
        Run run = new Run();
        run.at(T0, fresh(diskRoot("fail", "97% used")));

        // Unknown: no "Resolved", and no reminder either even after 24h.
        assertThat(run.at(T0.plusSeconds(300), fresh(diskRoot("unknown", "")))).isEmpty();
        assertThat(run.at(T0.plus(Duration.ofHours(1)), fresh(diskRoot("unknown", "")))).isEmpty();
        // Back to fail within the day: not news.
        assertThat(run.at(T0.plus(Duration.ofHours(2)), fresh(diskRoot("fail", "97% used")))).isEmpty();
        assertThat(run.at(T0.plus(Duration.ofHours(3)), fresh(diskRoot("unknown", "")))).isEmpty();
        assertThat(run.at(T0.plus(Duration.ofHours(25)), fresh(diskRoot("unknown", "")))).isEmpty();
        // Failing again more than a day after the last push: the overdue reminder, not a new failure.
        assertThat(run.at(T0.plus(Duration.ofHours(25).plusMinutes(5)), fresh(diskRoot("fail", "97% used"))))
                .extracting(Alert::kind).containsExactly(Kind.CHECK_REMINDER);
        // Back to ok: that is a resolution.
        assertThat(run.at(T0.plus(Duration.ofHours(26)), fresh(diskRoot("ok", "50% used"))))
                .extracting(Alert::kind).containsExactly(Kind.CHECK_RESOLVED);
    }

    @Test
    void aCheckThatDisappearsFromTheReport_isForgottenQuietly() {
        Run run = new Run();
        run.at(T0, fresh(diskRoot("fail", "97% used")));

        assertThat(run.at(T0.plusSeconds(300), fresh(check("hw.temp", "ok")))).isEmpty();
        assertThat(run.state.active()).isEmpty();
    }

    // ── Report going silent ──────────────────────────────────────────────────

    @Test
    void reportGoingStale_pushesOnce_thenResumes() {
        Run run = new Run();
        run.at(T0, fresh(check("disk.root", "ok")));

        List<Alert> silent = run.at(T0.plus(Duration.ofMinutes(40)), stale());
        assertThat(silent).singleElement().satisfies(a -> {
            assertThat(a.kind()).isEqualTo(Kind.REPORT_SILENT);
            assertThat(a.title()).isEqualTo("Health checks stopped reporting");
            assertThat(a.body()).contains("dbworldpi").contains("1 h old").contains("every 15 min");
        });
        assertThat(run.at(T0.plus(Duration.ofMinutes(45)), stale())).isEmpty();
        assertThat(run.at(T0.plus(Duration.ofHours(30)), stale())).isEmpty();

        assertThat(run.at(T0.plus(Duration.ofHours(31)), fresh(check("disk.root", "ok"))))
                .singleElement().extracting(Alert::kind).isEqualTo(Kind.REPORT_RESUMED);
    }

    @Test
    void reportDisappearingAfterBeingSeen_pushesOnce() {
        Run run = new Run();
        run.at(T0, fresh(check("disk.root", "ok")));

        assertThat(run.at(T0.plusSeconds(300), missing())).singleElement().satisfies(a -> {
            assertThat(a.kind()).isEqualTo(Kind.REPORT_SILENT);
            assertThat(a.body()).contains("can no longer be read").contains("No health report");
        });
        assertThat(run.at(T0.plusSeconds(600), missing())).isEmpty();
    }

    @Test
    void reportThatWasNeverThere_neverPushes() {
        // A dev box: no doctor, no file, and no reason to say anything about it.
        Run run = new Run();

        assertThat(run.at(T0, missing())).isEmpty();
        assertThat(run.at(T0.plus(Duration.ofDays(3)), missing())).isEmpty();
    }

    @Test
    void staleReportOnTheFirstRun_stillPushes() {
        // The timer died while the app was down. The file is there, so it has been "seen".
        Run run = new Run();

        assertThat(run.at(T0, stale())).extracting(Alert::kind).containsExactly(Kind.REPORT_SILENT);
    }

    @Test
    void whileSilent_failingChecksAreNeitherRemindedNorResolved() {
        Run run = new Run();
        run.at(T0, fresh(diskRoot("fail", "97% used")));
        run.at(T0.plusSeconds(300), stale());

        assertThat(run.at(T0.plus(Duration.ofHours(25)), stale())).isEmpty();
        assertThat(run.state.active()).containsKey("disk.root");

        // Fresh again and still failing: "reporting again" plus the overdue reminder, not a new failure.
        assertThat(run.at(T0.plus(Duration.ofHours(26)), fresh(diskRoot("fail", "97% used"))))
                .extracting(Alert::kind).containsExactly(Kind.REPORT_RESUMED, Kind.CHECK_REMINDER);
    }

    // ── Settings ─────────────────────────────────────────────────────────────

    @Test
    void alertsDisabled_pushNothing_andForgetEverything() {
        Run run = new Run();
        run.settings = DISABLED;

        assertThat(run.at(T0, fresh(diskRoot("fail", "97% used")))).isEmpty();
        assertThat(run.at(T0.plus(Duration.ofHours(25)), fresh(diskRoot("fail", "97% used")))).isEmpty();
        assertThat(run.state).isEqualTo(State.INITIAL);

        // Switched back on: whatever is failing right now is announced.
        run.settings = DEFAULTS;
        assertThat(run.at(T0.plus(Duration.ofHours(26)), fresh(diskRoot("fail", "97% used"))))
                .extracting(Alert::kind).containsExactly(Kind.CHECK_FAILING);
    }

    @Test
    void warn_doesNotPushByDefault() {
        Run run = new Run();

        assertThat(run.at(T0, fresh(diskRoot("warn", "86% used")))).isEmpty();
        assertThat(run.state.active()).isEmpty();
    }

    @Test
    void alertOnWarn_pushesWarnings_andEscalationToFail() {
        Run run = new Run();
        run.settings = WITH_WARN;

        assertThat(run.at(T0, fresh(diskRoot("warn", "86% used")))).singleElement().satisfies(a -> {
            assertThat(a.kind()).isEqualTo(Kind.CHECK_WARNING);
            assertThat(a.title()).isEqualTo("Pi warning: System disk space");
        });
        assertThat(run.at(T0.plusSeconds(300), fresh(diskRoot("warn", "87% used")))).isEmpty();
        // Warnings are not reminded about.
        assertThat(run.at(T0.plus(Duration.ofHours(25)), fresh(diskRoot("warn", "88% used")))).isEmpty();

        assertThat(run.at(T0.plus(Duration.ofHours(26)), fresh(diskRoot("fail", "97% used"))))
                .extracting(Alert::kind).containsExactly(Kind.CHECK_FAILING);
        assertThat(run.at(T0.plus(Duration.ofHours(27)), fresh(diskRoot("ok", "40% used"))))
                .extracting(Alert::kind).containsExactly(Kind.CHECK_RESOLVED);
    }

    @Test
    void warnAlertsSwitchedOffMidWarning_dropTheAlertWithoutAFalseResolved() {
        Run run = new Run();
        run.settings = WITH_WARN;
        run.at(T0, fresh(diskRoot("warn", "86% used")));

        run.settings = DEFAULTS;
        assertThat(run.at(T0.plusSeconds(300), fresh(diskRoot("warn", "86% used")))).isEmpty();
        assertThat(run.state.active()).isEmpty();
    }

    // ── Volume control ───────────────────────────────────────────────────────

    @Test
    void manyChangesInOnePass_areFoldedIntoOneDigest() {
        Run run = new Run();
        run.at(T0, fresh(check("disk.hdd", "ok"), check("smart.hdd", "ok"), check("backup.db", "ok"),
                check("svc.db_world", "fail")));

        List<Alert> alerts = run.at(T0.plusSeconds(300), fresh(
                check("disk.hdd", "fail"), check("smart.hdd", "fail"), check("backup.db", "fail"),
                check("svc.db_world", "ok")));

        assertThat(alerts).singleElement().satisfies(a -> {
            assertThat(a.kind()).isEqualTo(Kind.DIGEST);
            assertThat(a.title()).isEqualTo("Pi: 4 health alerts");
            assertThat(a.body()).isEqualTo(
                    "Failing: Check disk.hdd, Check smart.hdd, Check backup.db. Resolved: Check svc.db_world.");
        });
        // Each check is still tracked individually.
        assertThat(run.state.active()).containsOnlyKeys("disk.hdd", "smart.hdd", "backup.db");
    }

    @Test
    void threeChangesInOnePass_stayAsSeparatePushes() {
        Run run = new Run();

        assertThat(run.at(T0, fresh(check("a", "fail"), check("b", "fail"), check("c", "fail"))))
                .extracting(Alert::kind)
                .containsExactly(Kind.CHECK_FAILING, Kind.CHECK_FAILING, Kind.CHECK_FAILING);
    }

    @Test
    void aRepeatedId_isAlertedOnOnce() {
        Run run = new Run();

        assertThat(run.at(T0, fresh(check("disk.root", "fail"), check("disk.root", "fail")))).hasSize(1);
    }

    @Test
    void humanDuration_isCoarse() {
        assertThat(HostHealthAlertPolicy.humanDuration(Duration.ofMinutes(14))).isEqualTo("14 min");
        assertThat(HostHealthAlertPolicy.humanDuration(Duration.ofMinutes(90))).isEqualTo("1 h");
        assertThat(HostHealthAlertPolicy.humanDuration(Duration.ofHours(47))).isEqualTo("47 h");
        assertThat(HostHealthAlertPolicy.humanDuration(Duration.ofHours(72))).isEqualTo("3 days");
    }

    @Test
    void nextState_recordsTheFailureAndItsStart() {
        Outcome outcome = policy.evaluate(State.INITIAL, fresh(diskRoot("fail", "97% used")), DEFAULTS, T0);

        assertThat(outcome.next().active().get("disk.root").status()).isEqualTo(HostHealthStatus.FAIL);
        assertThat(outcome.next().active().get("disk.root").since()).isEqualTo(T0);
        assertThat(outcome.next().reportSeen()).isTrue();
    }
}
