package com.db.dbworld.app.system.health;

import com.db.dbworld.app.system.health.dto.HostHealthReport;
import com.db.dbworld.app.system.health.dto.HostHealthReport.Check;
import com.db.dbworld.app.system.health.dto.HostHealthReport.Counts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

class HostHealthServiceTest {

    /** 2026-10-04T16:45:00+05:30, the instant the sample report below was generated. */
    private static final long GENERATED = 1_791_112_500L;

    private static final String GOOD_REPORT = """
            {
              "version": 1,
              "host": "dbworldpi",
              "generatedAt": "2026-10-04T16:45:00+05:30",
              "generatedAtEpoch": 1791112500,
              "intervalSeconds": 900,
              "overall": "warn",
              "counts": {"ok": 1, "warn": 1, "fail": 0, "unknown": 0},
              "checks": [
                {"id": "disk.root", "group": "Disks", "name": "System disk space",
                 "status": "ok", "value": "77% used, 6.9 GB free",
                 "detail": "", "hint": "sudo dbworldctl cleanup"},
                {"id": "updates.security", "group": "Security", "name": "Security updates",
                 "status": "warn", "value": "3 pending", "detail": "openssl, libc6, sudo",
                 "hint": "sudo apt upgrade"}
              ]
            }
            """;

    @TempDir Path dir;
    private Path file;

    @BeforeEach
    void setUp() {
        file = dir.resolve("doctor.json");
    }

    /** A service whose clock reads {@code secondsAfterGeneration} past the sample report's time. */
    private HostHealthService serviceAt(long secondsAfterGeneration) {
        Clock clock = Clock.fixed(Instant.ofEpochSecond(GENERATED + secondsAfterGeneration), ZoneOffset.UTC);
        return new HostHealthService(file, clock);
    }

    private void write(String json) throws IOException {
        Files.writeString(file, json, StandardCharsets.UTF_8);
    }

    // ── Parsing ──────────────────────────────────────────────────────────────

    @Test
    void goodFile_parsesEveryField() throws IOException {
        write(GOOD_REPORT);

        HostHealthReport r = serviceAt(120).read();

        assertThat(r.available()).isTrue();
        assertThat(r.reason()).isNull();
        assertThat(r.stale()).isFalse();
        assertThat(r.ageSeconds()).isEqualTo(120L);
        assertThat(r.reportPath()).isEqualTo(file.toString());
        assertThat(r.version()).isEqualTo(1);
        assertThat(r.host()).isEqualTo("dbworldpi");
        assertThat(r.generatedAt()).isEqualTo("2026-10-04T16:45:00+05:30");
        assertThat(r.generatedAtEpoch()).isEqualTo(GENERATED);
        assertThat(r.intervalSeconds()).isEqualTo(900L);
        assertThat(r.overall()).isEqualTo("warn");
        assertThat(r.counts()).isEqualTo(new Counts(1, 1, 0, 0));
        assertThat(r.checks()).containsExactly(
                new Check("disk.root", "Disks", "System disk space", "ok",
                        "77% used, 6.9 GB free", "", "sudo dbworldctl cleanup"),
                new Check("updates.security", "Security", "Security updates", "warn",
                        "3 pending", "openssl, libc6, sudo", "sudo apt upgrade"));
    }

    @Test
    void missingFile_isUnavailableWithAReason() {
        HostHealthReport r = serviceAt(0).read();

        assertThat(r.available()).isFalse();
        assertThat(r.reason()).contains("No health report").contains(file.toString());
        assertThat(r.stale()).isFalse();
        assertThat(r.ageSeconds()).isNull();
        assertThat(r.checks()).isEmpty();
        assertThat(r.overall()).isEqualTo("unknown");
    }

    @Test
    void corruptFile_isUnavailableAndNeverThrows() throws IOException {
        // A truncated write: exactly what the atomic rename exists to prevent, and what this must
        // survive anyway if someone edits the file by hand.
        write(GOOD_REPORT.substring(0, GOOD_REPORT.length() / 2));
        HostHealthService service = serviceAt(0);

        assertThatCode(service::read).doesNotThrowAnyException();
        HostHealthReport r = service.read();
        assertThat(r.available()).isFalse();
        assertThat(r.reason()).contains("not valid JSON");
    }

    @Test
    void emptyFile_isUnavailable() throws IOException {
        write("   \n");

        HostHealthReport r = serviceAt(0).read();

        assertThat(r.available()).isFalse();
        assertThat(r.reason()).contains("is empty");
    }

    @Test
    void jsonThatIsNotAnObject_isUnavailable() throws IOException {
        write("[1, 2, 3]");

        HostHealthReport r = serviceAt(0).read();

        assertThat(r.available()).isFalse();
        assertThat(r.reason()).contains("not a JSON object");
    }

    @Test
    void oversizedFile_isRefusedWithoutLoadingIt() throws IOException {
        write(" ".repeat((int) HostHealthService.MAX_REPORT_BYTES + 1));

        HostHealthReport r = serviceAt(0).read();

        assertThat(r.available()).isFalse();
        assertThat(r.reason()).contains("too large");
    }

    @Test
    void unknownFields_areIgnored() throws IOException {
        write("""
                {"version": 2, "host": "dbworldpi", "generatedAtEpoch": 1791112500,
                 "intervalSeconds": 900, "overall": "ok", "kernel": {"release": "6.8"},
                 "futureList": [1, 2],
                 "checks": [{"id": "hw.temp", "group": "Hardware", "name": "CPU temperature",
                             "status": "ok", "value": "52 C", "detail": "", "hint": "",
                             "severity": 3, "tags": ["thermal"]}]}
                """);

        HostHealthReport r = serviceAt(0).read();

        assertThat(r.available()).isTrue();
        assertThat(r.version()).isEqualTo(2);
        assertThat(r.checks()).singleElement()
                .isEqualTo(new Check("hw.temp", "Hardware", "CPU temperature", "ok", "52 C", "", ""));
    }

    @Test
    void missingOptionalFields_getDefaults() throws IOException {
        // No interval, overall, counts, detail or hint; one check with no group, one with a status
        // this version does not know, and one entry that is not an object at all.
        write("""
                {"generatedAtEpoch": 1791112500,
                 "checks": [
                   {"id": "svc.db_world", "name": "db-world service", "status": "FAIL", "value": "inactive"},
                   {"id": "net.dns", "group": "Network", "name": "DNS", "status": "degraded"},
                   "not-a-check"
                 ]}
                """);

        HostHealthReport r = serviceAt(0).read();

        assertThat(r.available()).isTrue();
        assertThat(r.intervalSeconds()).isEqualTo(HostHealthService.DEFAULT_INTERVAL_SECONDS);
        assertThat(r.host()).isEmpty();
        assertThat(r.version()).isNull();
        assertThat(r.checks()).containsExactly(
                new Check("svc.db_world", "System", "db-world service", "fail", "inactive", "", ""),
                new Check("net.dns", "Network", "DNS", "unknown", "", "", ""));
        // Derived from the checks when the file does not say.
        assertThat(r.overall()).isEqualTo("fail");
        assertThat(r.counts()).isEqualTo(new Counts(0, 0, 1, 1));
    }

    @Test
    void checkWithoutAnId_getsAStableOneFromGroupAndName() throws IOException {
        write("""
                {"generatedAtEpoch": 1791112500,
                 "checks": [{"group": "Backups", "name": "Nightly DB dump", "status": "ok"}]}
                """);

        HostHealthReport r = serviceAt(0).read();

        assertThat(r.checks()).singleElement()
                .extracting(Check::id).isEqualTo("backups.nightly_db_dump");
    }

    @Test
    void numbersWrittenAsStrings_areStillRead() throws IOException {
        write("""
                {"generatedAtEpoch": "1791112500", "intervalSeconds": "600", "checks": []}
                """);

        HostHealthReport r = serviceAt(30).read();

        assertThat(r.generatedAtEpoch()).isEqualTo(GENERATED);
        assertThat(r.intervalSeconds()).isEqualTo(600L);
        assertThat(r.ageSeconds()).isEqualTo(30L);
    }

    // ── Staleness ────────────────────────────────────────────────────────────

    @Test
    void stale_onlyOnceOlderThanTwoIntervalsPlusAMinute() throws IOException {
        write(GOOD_REPORT);
        long limit = 2 * 900 + HostHealthService.STALE_GRACE_SECONDS;

        assertThat(serviceAt(limit).read().stale()).isFalse();
        assertThat(serviceAt(limit + 1).read().stale()).isTrue();
    }

    @Test
    void staleReport_isStillAvailableWithItsChecks() throws IOException {
        write(GOOD_REPORT);

        HostHealthReport r = serviceAt(3 * 3600).read();

        assertThat(r.available()).isTrue();
        assertThat(r.stale()).isTrue();
        assertThat(r.ageSeconds()).isEqualTo(3 * 3600L);
        assertThat(r.checks()).hasSize(2);
    }

    @Test
    void staleness_followsTheReportsOwnInterval() throws IOException {
        write("""
                {"generatedAtEpoch": 1791112500, "intervalSeconds": 60, "checks": []}
                """);

        // 2 x 60 + 60 = 180 s.
        assertThat(serviceAt(180).read().stale()).isFalse();
        assertThat(serviceAt(181).read().stale()).isTrue();
    }

    @Test
    void withoutAnEpoch_theIsoTimestampIsUsed() throws IOException {
        write("""
                {"generatedAt": "2026-10-04T16:45:00+05:30", "checks": []}
                """);

        assertThat(serviceAt(300).read().ageSeconds()).isEqualTo(300L);
    }

    @Test
    void withNoTimestampAtAll_theFileTimeIsUsed() {
        HostHealthService service = serviceAt(600);

        HostHealthReport r = service.parse("{\"checks\": []}", Instant.ofEpochSecond(GENERATED));

        assertThat(r.ageSeconds()).isEqualTo(600L);
        assertThat(r.generatedAt()).isNull();
        assertThat(r.generatedAtEpoch()).isNull();
    }

    @Test
    void aReportFromTheFuture_isZeroSecondsOldNotNegative() throws IOException {
        write(GOOD_REPORT);

        HostHealthReport r = serviceAt(-90).read();

        assertThat(r.ageSeconds()).isZero();
        assertThat(r.stale()).isFalse();
    }
}
