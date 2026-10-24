package com.db.dbworld.app.system.info.snapshot;

import com.db.dbworld.app.system.info.snapshot.HostInfoSnapshot.CommandResult;
import com.db.dbworld.app.system.info.snapshot.HostInfoSnapshot.StatVfs;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * The host-info.json reader: the version 1 contract, staleness, reload-on-change, and that host
 * mode never reads anything.
 */
class HostInfoSnapshotTest {

    /** 2026-10-07T23:30:00+05:30 is the contract example's generatedAt; this is its epoch second. */
    private static final long GENERATED = OffsetDateTime.parse("2026-10-07T23:30:00+05:30").toEpochSecond();

    /** The contract example, verbatim apart from the epoch being a parameter. */
    private static String contract(long generatedEpoch) {
        return """
                {
                  "version": 1,
                  "host": "dbworldpi",
                  "generatedAt": "2026-10-07T23:30:00+05:30",
                  "generatedAtEpoch": %d,
                  "intervalSeconds": 60,
                  "commands": [
                    {"argv": ["hostname"], "exit": 0, "stdout": "dbworldpi\\n", "capturedAtEpoch": %d},
                    {"argv": ["/usr/bin/vcgencmd", "get_throttled"], "exit": 0, "stdout": "throttled=0x0\\n", "capturedAtEpoch": %d},
                    {"argv": ["iwconfig"], "exit": 127, "stdout": "", "capturedAtEpoch": %d}
                  ],
                  "files":   { "/proc/device-tree/model": "Raspberry Pi 5 Model B Rev 1.0", "/etc/os-release": "PRETTY_NAME=\\"Ubuntu 24.04.4 LTS\\"\\n" },
                  "exists":  { "/dev/gpiochip0": true, "/sys/class/gpio": true, "/proc/device-tree/hat": false, "/proc/device-tree/display": false, "/boot/config.txt": false },
                  "statvfs": { "/": {"totalBytes": 31000000000, "freeBytes": 12000000000, "availableBytes": 10500000000, "readOnly": false},
                               "/srv/dbworld": {"totalBytes": 984000000000, "freeBytes": 190000000000, "availableBytes": 140000000000, "readOnly": false} }
                }
                """.formatted(generatedEpoch, generatedEpoch, generatedEpoch, generatedEpoch);
    }

    /** A one-command snapshot; {@code hostname} prints whatever is given. Same length for same-length input. */
    private static String withHostname(long generatedEpoch, String hostname) {
        return """
                {"version": 1, "generatedAtEpoch": %d,
                 "commands": [{"argv": ["hostname"], "exit": 0, "stdout": "%s"}]}
                """.formatted(generatedEpoch, hostname);
    }

    private static final class MovableClock extends Clock {
        private Instant now;

        MovableClock(Instant start) { this.now = start; }

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }

        void advance(Duration d) { now = now.plus(d); }
    }

    @TempDir Path dir;
    private Path file;
    private MovableClock clock;
    private HostInfoSnapshot snapshot;

    @BeforeEach
    void setUp() {
        file = dir.resolve("host-info.json");
        clock = new MovableClock(Instant.ofEpochSecond(GENERATED + 30));
        snapshot = new HostInfoSnapshot(true, file, clock);
    }

    private void write(String json) throws IOException {
        Files.writeString(file, json);
    }

    private void write(String json, FileTime modified) throws IOException {
        Files.writeString(file, json);
        Files.setLastModifiedTime(file, modified);
    }

    private Optional<String> hostnameStdout() {
        return snapshot.command(List.of("hostname")).map(CommandResult::stdout);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // The version 1 contract
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Contract {

        @BeforeEach
        void writeContract() throws IOException {
            write(contract(GENERATED));
        }

        @Test
        void commandsAreKeptWithTheirExitCodeAndUntrimmedStdout() {
            assertThat(snapshot.command(List.of("hostname"))).hasValueSatisfying(r -> {
                assertThat(r.exit()).isZero();
                // Trimming is exec()'s job, as it is for a real run; the reader keeps the bytes.
                assertThat(r.stdout()).isEqualTo("dbworldpi\n");
                assertThat(r.capturedAt()).isEqualTo(Instant.ofEpochSecond(GENERATED));
                assertThat(r.argv()).containsExactly("hostname");
            });
            assertThat(snapshot.command(List.of("iwconfig"))).hasValueSatisfying(r -> {
                assertThat(r.exit()).isEqualTo(127);
                assertThat(r.stdout()).isEmpty();
            });
        }

        @Test
        void argvIsMatchedExactlyElementByElement() {
            assertThat(snapshot.command(List.of("/usr/bin/vcgencmd", "get_throttled"))).isPresent();

            assertThat(snapshot.command(List.of("vcgencmd", "get_throttled"))).isEmpty();
            assertThat(snapshot.command(List.of("/usr/bin/vcgencmd", "get_throttled", "extra"))).isEmpty();
            assertThat(snapshot.command(List.of("/usr/bin/vcgencmd get_throttled"))).isEmpty();
            assertThat(snapshot.command(List.of("hostname "))).isEmpty();
            assertThat(snapshot.command(List.of("uname", "-r"))).isEmpty();
        }

        @Test
        void filesExistsAndStatvfsAreReadAsWritten() {
            assertThat(snapshot.file("/proc/device-tree/model")).contains("Raspberry Pi 5 Model B Rev 1.0");
            assertThat(snapshot.file("/etc/os-release")).contains("PRETTY_NAME=\"Ubuntu 24.04.4 LTS\"\n");
            assertThat(snapshot.file("/proc/meminfo")).isEmpty();

            assertThat(snapshot.exists("/dev/gpiochip0")).contains(true);
            assertThat(snapshot.exists("/proc/device-tree/hat")).contains(false);
            assertThat(snapshot.exists("/boot/firmware/config.txt")).isEmpty();

            assertThat(snapshot.statvfs("/srv/dbworld"))
                    .contains(new StatVfs(984_000_000_000L, 190_000_000_000L, 140_000_000_000L, false));
            assertThat(snapshot.statvfs("/mnt/elsewhere")).isEmpty();
        }

        @Test
        void generatedAtComesFromTheEpoch() {
            assertThat(snapshot.active()).isTrue();
            assertThat(snapshot.generatedAt()).contains(Instant.ofEpochSecond(GENERATED));
        }

        @Test
        void nullKeysAreJustAbsent() {
            assertThat(snapshot.command(null)).isEmpty();
            assertThat(snapshot.file(null)).isEmpty();
            assertThat(snapshot.exists(null)).isEmpty();
            assertThat(snapshot.statvfs(null)).isEmpty();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Host mode
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void hostModeAnswersNothingEvenWithAValidFileInPlace() throws IOException {
        write(contract(GENERATED));
        HostInfoSnapshot hostMode = new HostInfoSnapshot(false, file, clock);

        assertThat(hostMode.containerMode()).isFalse();
        assertThat(hostMode.active()).isFalse();
        assertThat(hostMode.generatedAt()).isEmpty();
        assertThat(hostMode.command(List.of("hostname"))).isEmpty();
        assertThat(hostMode.file("/proc/device-tree/model")).isEmpty();
        assertThat(hostMode.exists("/dev/gpiochip0")).isEmpty();
        assertThat(hostMode.statvfs("/")).isEmpty();
    }

    @Test
    void theSharedDisabledInstanceIsHostMode() {
        assertThat(HostInfoSnapshot.disabled().containerMode()).isFalse();
        assertThat(HostInfoSnapshot.disabled().active()).isFalse();
    }

    @Test
    void onlyTheWordContainerSelectsContainerMode() {
        assertThat(HostInfoSnapshot.isContainerRuntime("container")).isTrue();
        assertThat(HostInfoSnapshot.isContainerRuntime(" Container ")).isTrue();

        assertThat(HostInfoSnapshot.isContainerRuntime("host")).isFalse();
        assertThat(HostInfoSnapshot.isContainerRuntime("")).isFalse();
        assertThat(HostInfoSnapshot.isContainerRuntime(null)).isFalse();
        assertThat(HostInfoSnapshot.isContainerRuntime("docker")).isFalse();
    }

    @Test
    void theSpringConstructorReadsTheRuntimeProperty() {
        assertThat(new HostInfoSnapshot("container", "").containerMode()).isTrue();
        assertThat(new HostInfoSnapshot("host", file.toString()).containerMode()).isFalse();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Staleness
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Staleness {

        @Test
        void tenMinutesOldIsStillFresh() throws IOException {
            write(contract(GENERATED));
            clock.now = Instant.ofEpochSecond(GENERATED + HostInfoSnapshot.STALE_AFTER_SECONDS);

            assertThat(snapshot.active()).isTrue();
        }

        @Test
        void pastTenMinutesEverythingReadsAsMissing() throws IOException {
            write(contract(GENERATED));
            clock.now = Instant.ofEpochSecond(GENERATED + HostInfoSnapshot.STALE_AFTER_SECONDS + 1);

            assertThat(snapshot.active()).isFalse();
            assertThat(snapshot.generatedAt()).isEmpty();
            assertThat(snapshot.command(List.of("hostname"))).isEmpty();
            assertThat(snapshot.file("/proc/device-tree/model")).isEmpty();
            assertThat(snapshot.exists("/dev/gpiochip0")).isEmpty();
            assertThat(snapshot.statvfs("/")).isEmpty();
        }

        @Test
        void aFreshFileEndsTheStaleEpisode() throws IOException {
            write(contract(GENERATED), FileTime.fromMillis(1_000));
            clock.now = Instant.ofEpochSecond(GENERATED + 900);
            assertThat(snapshot.active()).isFalse();

            write(contract(GENERATED + 870), FileTime.fromMillis(2_000));
            clock.advance(Duration.ofSeconds(1));

            assertThat(snapshot.active()).isTrue();
            assertThat(hostnameStdout()).contains("dbworldpi\n");
        }

        @Test
        void aHostClockAheadOfOursIsFreshNotAnError() throws IOException {
            write(contract(GENERATED + 120));

            assertThat(snapshot.active()).isTrue();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // generatedAt fallbacks
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void withoutAnEpochTheOffsetTimestampIsUsed() throws IOException {
        write("""
                {"version": 1, "generatedAt": "2026-10-07T23:30:00+05:30", "commands": []}
                """);

        assertThat(snapshot.generatedAt()).contains(Instant.ofEpochSecond(GENERATED));
    }

    @Test
    void withNoTimestampAtAllTheFileTimeIsUsed() throws IOException {
        write("{\"commands\": []}", FileTime.from(Instant.ofEpochSecond(GENERATED - 10)));

        assertThat(snapshot.generatedAt()).contains(Instant.ofEpochSecond(GENERATED - 10));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Reloading
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Reloading {

        @Test
        void anUnchangedFileIsNotParsedAgain() throws IOException {
            FileTime t1 = FileTime.fromMillis(1_000_000);
            write(withHostname(GENERATED, "first"), t1);
            assertThat(hostnameStdout()).contains("first");

            // Same size and same modification time: indistinguishable from "unchanged".
            write(withHostname(GENERATED, "other"), t1);
            clock.advance(Duration.ofSeconds(5));
            assertThat(hostnameStdout()).contains("first");

            Files.setLastModifiedTime(file, FileTime.fromMillis(2_000_000));
            clock.advance(Duration.ofSeconds(1));
            assertThat(hostnameStdout()).contains("other");
        }

        @Test
        void aSizeChangeAloneAlsoTriggersAReload() throws IOException {
            FileTime t1 = FileTime.fromMillis(1_000_000);
            write(withHostname(GENERATED, "first"), t1);
            assertThat(hostnameStdout()).contains("first");

            write(withHostname(GENERATED, "longer-name"), t1);
            clock.advance(Duration.ofSeconds(1));
            assertThat(hostnameStdout()).contains("longer-name");
        }

        @Test
        void theFileIsLookedAtNoMoreThanOnceASecond() throws IOException {
            write(withHostname(GENERATED, "first"), FileTime.fromMillis(1_000_000));
            assertThat(hostnameStdout()).contains("first");

            write(withHostname(GENERATED, "second"), FileTime.fromMillis(2_000_000));
            assertThat(hostnameStdout()).contains("first");
            clock.advance(Duration.ofMillis(999));
            assertThat(hostnameStdout()).contains("first");

            clock.advance(Duration.ofMillis(1));
            assertThat(hostnameStdout()).contains("second");
        }

        @Test
        void aSnapshotThatAppearsLaterIsPickedUp() throws IOException {
            assertThat(snapshot.active()).isFalse();

            write(contract(GENERATED));
            clock.advance(Duration.ofSeconds(1));

            assertThat(snapshot.active()).isTrue();
        }

        @Test
        void aDeletedSnapshotStopsAnswering() throws IOException {
            write(contract(GENERATED));
            assertThat(snapshot.active()).isTrue();

            Files.delete(file);
            clock.advance(Duration.ofSeconds(1));

            assertThat(snapshot.active()).isFalse();
            assertThat(snapshot.command(List.of("hostname"))).isEmpty();
        }

        @Test
        void aBrokenFileIsReplacedByAGoodOneOnTheNextChange() throws IOException {
            write("{ not json", FileTime.fromMillis(1_000_000));
            assertThat(snapshot.active()).isFalse();

            write(contract(GENERATED), FileTime.fromMillis(2_000_000));
            clock.advance(Duration.ofSeconds(1));

            assertThat(snapshot.active()).isTrue();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Unusable files
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class UnusableFiles {

        @Test
        void aMissingFileAnswersNothingAndDoesNotThrow() {
            assertThatCode(() -> {
                assertThat(snapshot.active()).isFalse();
                assertThat(snapshot.command(List.of("hostname"))).isEmpty();
                assertThat(snapshot.file("/etc/os-release")).isEmpty();
            }).doesNotThrowAnyException();
        }

        @Test
        void invalidJsonAnswersNothing() throws IOException {
            write("{ \"version\": 1, \"commands\": [ ");

            assertThat(snapshot.active()).isFalse();
            assertThat(snapshot.command(List.of("hostname"))).isEmpty();
        }

        @Test
        void anEmptyFileAnswersNothing() throws IOException {
            write("   ");

            assertThat(snapshot.active()).isFalse();
        }

        @Test
        void aJsonArrayIsNotASnapshot() throws IOException {
            write("[1, 2, 3]");

            assertThat(snapshot.active()).isFalse();
        }

        @Test
        void aNewerContractVersionIsNotGuessedAt() throws IOException {
            write(contract(GENERATED).replace("\"version\": 1", "\"version\": 2"));

            assertThat(snapshot.active()).isFalse();
        }

        @Test
        void aFileWithNoVersionIsReadAsVersionOne() throws IOException {
            write(contract(GENERATED).replace("\"version\": 1,", ""));

            assertThat(snapshot.active()).isTrue();
        }

        @Test
        void aDirectoryWhereTheFileShouldBeAnswersNothing() throws IOException {
            Files.createDirectories(file);

            assertThat(snapshot.active()).isFalse();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Lenient per-entry parsing
    // ──────────────────────────────────────────────────────────────────────────

    @Test
    void malformedEntriesAreDroppedWithoutLosingTheRest() throws IOException {
        write("""
                {
                  "version": 1,
                  "generatedAtEpoch": %d,
                  "commands": [
                    {"argv": ["ok"], "exit": 0, "stdout": "fine"},
                    {"argv": ["bad", 7], "exit": 0, "stdout": "numeric argv element"},
                    {"argv": [], "exit": 0, "stdout": "empty argv"},
                    {"exit": 0, "stdout": "no argv"},
                    "not an object",
                    {"argv": ["no-exit"], "stdout": "ran?"},
                    {"argv": ["no-stdout"], "exit": 0}
                  ],
                  "files": {"/a": "text", "/b": 42, "/c": null},
                  "exists": {"/x": true, "/y": "false", "/z": "maybe", "/w": 1},
                  "statvfs": {
                    "/": {"totalBytes": 100, "freeBytes": 40},
                    "/ro": {"totalBytes": "200", "freeBytes": 50, "availableBytes": 30, "readOnly": true},
                    "/broken": {"totalBytes": 100},
                    "/negative": {"totalBytes": -1, "freeBytes": 0},
                    "/scalar": 5
                  }
                }
                """.formatted(GENERATED));

        assertThat(snapshot.command(List.of("ok"))).map(CommandResult::stdout).contains("fine");
        assertThat(snapshot.command(List.of("bad", "7"))).isEmpty();
        // A missing exit code is no evidence the command ran, so it reads as a failure.
        assertThat(snapshot.command(List.of("no-exit"))).map(CommandResult::exit).contains(-1);
        assertThat(snapshot.command(List.of("no-stdout"))).map(CommandResult::stdout).contains("");

        assertThat(snapshot.file("/a")).contains("text");
        assertThat(snapshot.file("/b")).isEmpty();
        assertThat(snapshot.file("/c")).isEmpty();

        assertThat(snapshot.exists("/x")).contains(true);
        assertThat(snapshot.exists("/y")).contains(false);
        assertThat(snapshot.exists("/z")).isEmpty();
        assertThat(snapshot.exists("/w")).isEmpty();

        // availableBytes defaults to freeBytes, readOnly to false.
        assertThat(snapshot.statvfs("/")).contains(new StatVfs(100, 40, 40, false));
        assertThat(snapshot.statvfs("/ro")).contains(new StatVfs(200, 50, 30, true));
        assertThat(snapshot.statvfs("/broken")).isEmpty();
        assertThat(snapshot.statvfs("/negative")).isEmpty();
        assertThat(snapshot.statvfs("/scalar")).isEmpty();
    }
}
