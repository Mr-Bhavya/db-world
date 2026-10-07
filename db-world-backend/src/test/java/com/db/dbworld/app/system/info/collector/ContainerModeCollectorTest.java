package com.db.dbworld.app.system.info.collector;

import com.db.dbworld.app.system.info.collector.linux.RaspberryPiServerInfoCollector;
import com.db.dbworld.app.system.info.dto.DiskInfo;
import com.db.dbworld.app.system.info.dto.DriveInfo;
import com.db.dbworld.app.system.info.dto.TemperatureInfo;
import com.db.dbworld.app.system.info.dto.TemperatureSensor;
import com.db.dbworld.app.system.info.dto.os.raspberrypi.HatInfo;
import com.db.dbworld.app.system.info.dto.os.raspberrypi.RaspberryPiServerInfo;
import com.db.dbworld.app.system.info.snapshot.HostInfoSnapshot;
import com.db.dbworld.core.processor.ProcessExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.ObjectMapper;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * The collectors with the backend in a container: commands answered from the host's snapshot
 * and never executed, host-only files and existence checks from the snapshot, everything else
 * live. And in host mode, that the snapshot is never consulted at all.
 *
 * <p>Unlike the parse tests, {@code exec(...)} is <em>not</em> overridden here: the real one runs,
 * over a mocked {@link ProcessExecutor} that proves whether a process would have been started.
 * {@code fsRoot()} still points the live reads at a fixture tree.
 */
class ContainerModeCollectorTest {

    private static final long GENERATED = 1_791_400_000L;
    private static final String VCGENCMD = "/usr/bin/vcgencmd";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @TempDir Path root;
    @TempDir Path run;

    private Path snapshotFile;
    private ProcessExecutor processExecutor;
    private Clock clock;

    private final List<Map<String, Object>> commands = new ArrayList<>();
    private final Map<String, Object> files = new LinkedHashMap<>();
    private final Map<String, Object> exists = new LinkedHashMap<>();
    private final Map<String, Object> statvfs = new LinkedHashMap<>();

    private RaspberryPiServerInfoCollector collector;

    @BeforeEach
    void setUp() {
        snapshotFile = run.resolve("host-info.json");
        processExecutor = mock(ProcessExecutor.class);
        clock = clockAt(GENERATED + 30);
        collector = collectorWith(new HostInfoSnapshot(true, snapshotFile, clock));
    }

    private static Clock clockAt(long epochSecond) {
        return Clock.fixed(Instant.ofEpochSecond(epochSecond), ZoneOffset.UTC);
    }

    private RaspberryPiServerInfoCollector collectorWith(HostInfoSnapshot snapshot) {
        return new RaspberryPiServerInfoCollector(processExecutor, snapshot) {
            @Override
            protected Path fsRoot() {
                return root;
            }
        };
    }

    // ── Snapshot + fixture builders ───────────────────────────────────────────

    private void command(int exit, String stdout, String... argv) {
        commands.add(Map.of("argv", List.of(argv), "exit", exit, "stdout", stdout, "capturedAtEpoch", GENERATED));
    }

    private void writeSnapshot() throws IOException {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("version", 1);
        json.put("host", "dbworldpi");
        json.put("generatedAt", "2026-10-07T23:30:00+05:30");
        json.put("generatedAtEpoch", GENERATED);
        json.put("intervalSeconds", 60);
        json.put("commands", commands);
        json.put("files", files);
        json.put("exists", exists);
        json.put("statvfs", statvfs);
        Files.writeString(snapshotFile, MAPPER.writeValueAsString(json));
    }

    private void writeFixture(String absolutePath, String content) throws IOException {
        Path target = root.resolve(absolutePath.substring(1));
        Files.createDirectories(target.getParent());
        Files.writeString(target, content);
    }

    private void assertNoProcessStarted() throws Exception {
        verify(processExecutor, never()).execute(any());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // exec(...) from the snapshot
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Commands {

        @Test
        void exitZeroGivesTheTrimmedStdout() throws Exception {
            command(0, "dbworldpi\n", "hostname");
            writeSnapshot();

            assertThat(collector.exec("hostname")).isEqualTo("dbworldpi");
            assertNoProcessStarted();
        }

        @Test
        void exitOneStillGivesTheOutputLikeARealRun() throws Exception {
            command(1, "  partial output \n", "ss", "-tulnp");
            writeSnapshot();

            assertThat(collector.exec(5, "ss", "-tulnp")).isEqualTo("partial output");
            assertNoProcessStarted();
        }

        @Test
        void anyOtherExitCodeGivesNothing() throws Exception {
            command(127, "", "iwconfig");
            command(2, "usage: lsusb ...\n", "lsusb");
            writeSnapshot();

            assertThat(collector.exec("iwconfig")).isEmpty();
            assertThat(collector.exec("lsusb")).isEmpty();
            assertNoProcessStarted();
        }

        @Test
        void aCommandTheSnapshotDoesNotCarryIsNotRunEither() throws Exception {
            writeSnapshot();

            assertThat(collector.exec("xrandr")).isEmpty();
            assertNoProcessStarted();
        }

        @Test
        void theArgvMustMatchExactly() throws Exception {
            command(0, "throttled=0x0\n", VCGENCMD, "get_throttled");
            writeSnapshot();

            assertThat(collector.exec("vcgencmd", "get_throttled")).isEmpty();
            assertThat(collector.exec(VCGENCMD, "get_throttled", "now")).isEmpty();
            assertThat(collector.exec(VCGENCMD, "get_throttled")).isEqualTo("throttled=0x0");
            assertNoProcessStarted();
        }

        @Test
        void execLinesSplitsTheRecordedOutput() throws Exception {
            command(0, "Bus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub\n"
                    + "Bus 002 Device 001: ID 1d6b:0003 Linux Foundation 3.0 root hub\n", "lsusb");
            writeSnapshot();

            assertThat(collector.execLines("lsusb")).hasSize(2);
            assertThat(collector.getUsbDevices()).extracting(d -> d.get("id"))
                    .containsExactly("1d6b:0002", "1d6b:0003");
            assertNoProcessStarted();
        }

        @Test
        void vcgencmdFromTheSnapshotSitsBesideLiveThermalZones() throws Exception {
            // The temperature itself is the host kernel's /sys, read live; throttling needs
            // vcgencmd, which only the host can run.
            writeFixture("/sys/class/thermal/thermal_zone0/temp", "48000");
            command(0, "throttled=0x50005\n", VCGENCMD, "get_throttled");
            writeSnapshot();

            TemperatureInfo info = collector.getTemperatureInfo();

            assertThat(info.getSensors()).extracting(TemperatureSensor::getName)
                    .containsExactly("CPU Temperature", "Throttling Status");
            assertThat(info.getHighestTemperatureCelsius()).isEqualTo(48.0);
            assertThat(info.getSensors().get(1).getStatus()).isEqualTo("Throttling Active");
            assertNoProcessStarted();
        }

        @Test
        void bothDpkgFormatStringsAreMatchedLiterally() throws Exception {
            // The Pi collector passes a literal backslash-n for dpkg-query to expand itself;
            // the Linux one passes real tab and newline characters. The writer must copy each as is.
            command(0, "curl|8.5.0|arm64|512|transfer tool\n", "dpkg-query", "-W",
                    "-f=${Package}|${Version}|${Architecture}|${Installed-Size}|${Description}\\n");
            writeSnapshot();

            assertThat(collector.getInstalledPackages()).singleElement()
                    .satisfies(p -> assertThat(p.getName()).isEqualTo("curl"));
            assertNoProcessStarted();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Host files and existence checks
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class HostFiles {

        @Test
        void theSnapshotsDeviceTreeModelWinsOverTheContainersFilesystem() throws Exception {
            writeFixture("/proc/device-tree/model", "Container Board");
            files.put("/proc/device-tree/model", "Raspberry Pi 5 Model B Rev 1.0");
            writeSnapshot();

            assertThat(collector.getRaspberryPiInfo().getModel()).isEqualTo("Raspberry Pi 5 Model B Rev 1.0");
            assertThat(collector.getServerInfo().getModel()).isEqualTo("Raspberry Pi 5 Model B Rev 1.0");
            assertThat(collector.getRaspberryPiInfo().getSoc()).isEqualTo("BCM2712");
        }

        @Test
        void pathsTheSnapshotDoesNotCarryAreReadLive() throws Exception {
            // /proc/meminfo and /proc/version are the host kernel's in a container too.
            files.put("/proc/device-tree/model", "Raspberry Pi 5 Model B Rev 1.0");
            writeSnapshot();
            writeFixture("/proc/meminfo", "MemTotal:        8065536 kB\n");
            writeFixture("/proc/version", "Linux version 6.8.0-1010-raspi (buildd@bos02-arm64) #11-Ubuntu SMP");

            assertThat(collector.getRaspberryPiInfo().getMemoryMB()).isEqualTo(7876);
            assertThat(collector.getServerInfo().getKernelVersion()).isEqualTo("6.8.0-1010-raspi");
        }

        @Test
        void osReleaseComesFromTheHostNotTheImage() throws Exception {
            writeFixture("/etc/os-release", "PRETTY_NAME=\"Debian GNU/Linux 12 (bookworm)\"\nNAME=\"Debian GNU/Linux\"\n");
            files.put("/etc/os-release", "PRETTY_NAME=\"Ubuntu 24.04.4 LTS\"\nNAME=\"Ubuntu\"\nVERSION_ID=\"24.04\"\n");
            command(0, "dbworldpi\n", "hostname");
            writeSnapshot();

            var info = collector.getServerInfo();

            assertThat(info.getOsName()).isEqualTo("Ubuntu 24.04.4 LTS");
            assertThat(info.getDistribution()).isEqualTo("Ubuntu");
            assertThat(info.getHostname()).isEqualTo("dbworldpi");
        }

        @Test
        void gpioIsAccessibleWhenTheHostSaysSoThoughTheContainerHasNoDevice() throws Exception {
            exists.put("/dev/gpiochip0", true);
            exists.put("/sys/class/gpio", false);
            command(0, "GPIO 0: level=1 fsel=0 func=INPUT\nGPIO 2: level=1 fsel=4 alt=0 func=SDA1\n", "raspi-gpio", "get");
            writeSnapshot();

            var gpio = collector.getGpioInfo();

            assertThat(gpio.getGpioAccessible()).isTrue();
            assertThat(gpio.getPins()).hasSize(2);
            assertNoProcessStarted();
        }

        @Test
        void aSnapshotFalseBeatsAPathTheContainerHappensToHave() throws Exception {
            writeFixture("/proc/device-tree/hat/vendor", "Container Ltd.");
            writeFixture("/proc/device-tree/display/status", "okay");
            exists.put("/proc/device-tree/hat", false);
            exists.put("/proc/device-tree/display", false);
            writeSnapshot();

            assertThat(collector.getHatInfo().getHatPresent()).isFalse();
            assertThat(collector.getDisplayInfo().getDisplayType()).isEqualTo("HDMI");
        }

        @Test
        void hatFieldsComeFromTheSnapshotAndACarriedFileExistsByDefinition() throws Exception {
            exists.put("/proc/device-tree/hat", true);
            files.put("/proc/device-tree/hat/vendor", "Raspberry Pi Ltd.");
            files.put("/proc/device-tree/hat/product", "PoE+ HAT");
            writeSnapshot();

            HatInfo hat = collector.getHatInfo();

            assertThat(hat.getHatPresent()).isTrue();
            assertThat(hat.getHatVendor()).isEqualTo("Raspberry Pi Ltd.");
            assertThat(hat.getHatProduct()).isEqualTo("PoE+ HAT");
            assertThat(hat.getHatVersion()).isNull();
        }

        @Test
        void aPathTheSnapshotSaysIsAbsentReadsAsEmptyEvenIfTheContainerHasIt() throws Exception {
            writeFixture("/boot/config.txt", "arm_freq=2800\n");
            exists.put("/boot/config.txt", false);
            writeSnapshot();

            assertThat(collector.readHostFile("/boot/config.txt")).isEmpty();
            assertThat(collector.hostPathExists("/boot/config.txt")).isFalse();
        }

        @Test
        void ubuntusFirmwareConfigTxtIsUsedWhenTheHostHasNoBootConfigTxt() throws Exception {
            exists.put("/boot/config.txt", false);
            files.put("/boot/firmware/config.txt", "arm_freq=2400\nover_voltage=2\nstart_x=1\ngpu_mem=128\n");
            writeSnapshot();

            assertThat(collector.getOverclockInfo().getArmFrequency()).isEqualTo(2400);
            assertThat(collector.getOverclockInfo().getOverVoltage()).isTrue();
            assertThat(collector.getCameraInfo().getCameraEnabled()).isTrue();
        }

        @Test
        void theRaspberryPiCheckReadsTheModelFromTheSnapshot() throws Exception {
            // No /proc/device-tree and no /proc/cpuinfo in the fixture: only the snapshot knows.
            files.put("/proc/device-tree/model", "Raspberry Pi 5 Model B Rev 1.0");
            writeSnapshot();

            assertThat(collector.isRaspberryPi()).isTrue();
            assertThat(collector.createServerInfo()).isInstanceOf(RaspberryPiServerInfo.class);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Disk usage
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class DiskUsage {

        @Test
        void aHostMountPointGetsTheHostsStatvfs() throws Exception {
            statvfs.put("/srv/dbworld", Map.of("totalBytes", 1_000_000_000L, "freeBytes", 250_000_000L,
                    "availableBytes", 200_000_000L, "readOnly", true));
            writeSnapshot();

            DriveInfo drive = collector.getDiskUsageForPath("/srv/dbworld");

            assertThat(drive.getTotalBytes()).isEqualTo(1_000_000_000L);
            assertThat(drive.getFreeBytes()).isEqualTo(250_000_000L);
            assertThat(drive.getUsedBytes()).isEqualTo(750_000_000L);
            assertThat(drive.getUsedPercent()).isEqualTo(String.format("%.1f", 75.0));
            assertThat(drive.getReadOnly()).isTrue();
            assertThat(drive.getMountPoint()).isEqualTo("/srv/dbworld");
        }

        @Test
        void aMountPointTheSnapshotDoesNotCarryIsMeasuredLive() throws Exception {
            statvfs.put("/", Map.of("totalBytes", 1L, "freeBytes", 1L));
            writeSnapshot();
            String local = run.toString();

            DriveInfo drive = collector.getDiskUsageForPath(local);

            assertThat(drive.getTotalBytes()).isEqualTo(new File(local).getTotalSpace()).isPositive();
        }

        @Test
        void lsblkFromTheSnapshotIsSizedWithTheSnapshotsStatvfs() throws Exception {
            command(0, """
                    {"blockdevices": [
                      {"name": "sda", "size": 1000204886016, "type": "disk", "mountpoint": null, "tran": "usb",
                       "rm": false, "hotplug": true, "ro": false, "children": [
                        {"name": "sda1", "size": 1000203837440, "type": "part", "mountpoint": "/srv/dbworld",
                         "fstype": "ext4", "label": "media", "rm": false, "hotplug": true, "ro": false}
                      ]},
                      {"name": "mmcblk0p2", "size": 31000000000, "type": "part", "mountpoint": "/",
                       "fstype": "ext4", "rm": false, "hotplug": false, "ro": false}
                    ]}
                    """, "lsblk", "-J", "-b", "-o", "NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE,VENDOR,MODEL,SERIAL,TRAN,RO,RM,HOTPLUG,LABEL");
            statvfs.put("/", Map.of("totalBytes", 31_000_000_000L, "freeBytes", 12_000_000_000L));
            statvfs.put("/srv/dbworld", Map.of("totalBytes", 984_000_000_000L, "freeBytes", 190_000_000_000L));
            writeSnapshot();

            DiskInfo disk = collector.getDiskInfo();

            assertThat(disk.getDrives()).extracting(DriveInfo::getMountPoint).containsExactly("/srv/dbworld", "/");
            assertThat(disk.getTotalSpace()).isEqualTo(1_015_000_000_000L);
            assertThat(disk.getFreeSpace()).isEqualTo(202_000_000_000L);
            assertNoProcessStarted();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // No usable snapshot
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class NoUsableSnapshot {

        private void assertBehavesAsWithoutASnapshot() throws Exception {
            writeFixture("/proc/device-tree/model", "Live Board");
            writeFixture("/dev/gpiochip0", "");

            assertThat(collector.exec("hostname")).isEmpty();
            assertThat(collector.readHostFile("/proc/device-tree/model")).isEqualTo("Live Board");
            assertThat(collector.hostPathExists("/dev/gpiochip0")).isTrue();
            assertThat(collector.hostPathExists("/proc/device-tree/hat")).isFalse();
            assertThat(collector.getDiskUsageForPath(run.toString()).getTotalBytes())
                    .isEqualTo(new File(run.toString()).getTotalSpace());
            // Still container mode: a missing snapshot is no reason to start running commands.
            assertNoProcessStarted();
        }

        @Test
        void aStaleSnapshotIsIgnoredEntirely() throws Exception {
            command(0, "dbworldpi\n", "hostname");
            files.put("/proc/device-tree/model", "Raspberry Pi 5 Model B Rev 1.0");
            exists.put("/dev/gpiochip0", false);
            exists.put("/proc/device-tree/hat", true);
            statvfs.put(run.toString(), Map.of("totalBytes", 1L, "freeBytes", 1L));
            writeSnapshot();
            collector = collectorWith(new HostInfoSnapshot(true, snapshotFile, clockAt(GENERATED + 601)));

            assertBehavesAsWithoutASnapshot();
        }

        @Test
        void aMissingSnapshotFallsBackToLiveFilesAndRunsNothing() throws Exception {
            assertBehavesAsWithoutASnapshot();
        }

        @Test
        void anUnparseableSnapshotFallsBackTheSameWay() throws Exception {
            Files.writeString(snapshotFile, "{ \"version\": 1, \"commands\": [");

            assertBehavesAsWithoutASnapshot();
        }

        @Test
        void aPiIsStillRecognisedFromTheLiveCpuinfoBeforeTheFirstSnapshot() throws Exception {
            writeFixture("/proc/cpuinfo", "Hardware\t: BCM2835\nModel\t\t: Raspberry Pi 5 Model B Rev 1.0\n");

            assertThat(collector.isRaspberryPi()).isTrue();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Host mode: the snapshot is never consulted
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class HostMode {

        @Test
        void commandsRunAndFilesAreReadLiveEvenWithASnapshotOnDisk() throws Exception {
            // A snapshot that would answer every one of these if it were consulted.
            command(0, "dbworldpi\n", "hostname");
            files.put("/proc/device-tree/model", "Raspberry Pi 5 Model B Rev 1.0");
            exists.put("/dev/gpiochip0", true);
            statvfs.put(run.toString(), Map.of("totalBytes", 1L, "freeBytes", 1L));
            writeSnapshot();
            writeFixture("/proc/device-tree/model", "Live Board");

            HostInfoSnapshot hostMode = spy(new HostInfoSnapshot(false, snapshotFile, clock));
            RaspberryPiServerInfoCollector live = collectorWith(hostMode);

            // The mocked executor returns no result, which the real exec() reads as "".
            assertThat(live.exec("hostname")).isEmpty();
            verify(processExecutor, times(1)).execute(any());

            assertThat(live.readHostFile("/proc/device-tree/model")).isEqualTo("Live Board");
            assertThat(live.getRaspberryPiInfo().getModel()).isEqualTo("Live Board");
            assertThat(live.hostPathExists("/dev/gpiochip0")).isFalse();
            assertThat(live.getDiskUsageForPath(run.toString()).getTotalBytes())
                    .isEqualTo(new File(run.toString()).getTotalSpace());

            verify(hostMode, never()).command(any());
            verify(hostMode, never()).file(any());
            verify(hostMode, never()).exists(any());
            verify(hostMode, never()).statvfs(any());
            verify(hostMode, never()).generatedAt();
        }

        @Test
        void collectorsBuiltWithoutASnapshotAreHostMode() throws Exception {
            var plain = new RaspberryPiServerInfoCollector(processExecutor) {
                @Override
                protected Path fsRoot() {
                    return root;
                }
            };

            plain.exec("hostname");

            verify(processExecutor, times(1)).execute(any());
        }
    }
}
