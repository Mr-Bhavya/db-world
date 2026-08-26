package com.db.dbworld.app.system.info.collector.linux;

import com.db.dbworld.app.system.info.dto.*;
import com.db.dbworld.core.processor.ProcessExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.Mockito.mock;

/**
 * Drives the /proc and /sys parsers with a fixture filesystem tree.
 *
 * <p>These parsers were unreachable from tests until {@code ServerInfoCollector} grew the
 * {@link com.db.dbworld.app.system.info.collector.ServerInfoCollector#fsRoot()} seam: every
 * pseudo-file location was a hardcoded absolute {@code Path} constant, so nothing under
 * /proc or /sys could be parsed off a real Linux host. Overriding {@code fsRoot()} to a
 * {@link TempDir} makes the whole read-then-parse path testable, the same way the
 * overridable {@code exec(...)} seam makes the command-driven branches testable in
 * {@link LinuxServerInfoCollectorServicesTest}.
 */
class LinuxServerInfoCollectorParseTest {

    @TempDir
    Path root;

    /** Canned command output keyed by the first token of the command. */
    private final Map<String, String> cannedCommands = new java.util.HashMap<>();

    private LinuxServerInfoCollector collector;

    @BeforeEach
    void setUp() {
        cannedCommands.clear();
        collector = new LinuxServerInfoCollector(mock(ProcessExecutor.class)) {
            @Override
            protected Path fsRoot() {
                return root;
            }

            @Override
            protected String exec(int timeoutSeconds, String... command) {
                return command.length == 0 ? "" : cannedCommands.getOrDefault(command[0], "");
            }
        };
    }

    private void writeFile(String absolutePath, String content) throws IOException {
        Path target = root.resolve(absolutePath.startsWith("/") ? absolutePath.substring(1) : absolutePath);
        Files.createDirectories(target.getParent());
        Files.writeString(target, content);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // /proc/meminfo
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class MemInfo {

        private static final String MEMINFO = """
                MemTotal:        8065536 kB
                MemFree:         1048576 kB
                MemAvailable:    6291456 kB
                Buffers:          262144 kB
                Cached:          3145728 kB
                SReclaimable:     524288 kB
                SwapTotal:       2097152 kB
                SwapFree:        1572864 kB
                """;

        @Test
        void usedIsTotalMinusAvailable_notTotalMinusFree() throws IOException {
            writeFile("/proc/meminfo", MEMINFO);

            MemoryInfo mem = collector.getMemoryInfo();

            // 8065536 - 6291456 = 1774080 kB. Reclaimable page cache counts as available,
            // so "used" must not be derived from MemFree.
            assertThat(mem.getTotalBytes()).isEqualTo(8065536L * 1024);
            assertThat(mem.getUsedBytes()).isEqualTo(1774080L * 1024);
            assertThat(mem.getFreeBytes()).isEqualTo(1048576L * 1024);
            assertThat(mem.getUsedPercent()).isEqualTo("22.0");
        }

        @Test
        void cachedFoldsInSReclaimable() throws IOException {
            writeFile("/proc/meminfo", MEMINFO);

            MemoryInfo mem = collector.getMemoryInfo();

            // Cached (3145728) + SReclaimable (524288) = 3670016 kB = 3.50 GB
            assertThat(mem.getCachedFormatted()).isEqualTo("3.50 GB");
            assertThat(mem.getBuffersFormatted()).isEqualTo("256.00 MB");
        }

        @Test
        void swapUsageIsDerivedFromTotalMinusFree() throws IOException {
            writeFile("/proc/meminfo", MEMINFO);

            MemoryInfo mem = collector.getMemoryInfo();

            assertThat(mem.getSwapTotalBytes()).isEqualTo(2097152L * 1024);
            assertThat(mem.getSwapUsedBytes()).isEqualTo(524288L * 1024);
            assertThat(mem.getSwapUsedPercent()).isEqualTo("25.0");
        }

        @Test
        void missingMeminfoYieldsZerosRatherThanThrowing() {
            MemoryInfo mem = collector.getMemoryInfo();

            assertThat(mem.getTotalBytes()).isZero();
            // calculatePercentage guards total <= 0, so this must not be NaN.
            assertThat(mem.getUsedPercent()).isEqualTo("0.0");
        }

        @Test
        void nonNumericValuesAreSkippedWithoutLosingTheRestOfTheFile() throws IOException {
            writeFile("/proc/meminfo", """
                    MemTotal:        8065536 kB
                    MemAvailable:    corrupt kB
                    SwapTotal:       2097152 kB
                    """);

            MemoryInfo mem = collector.getMemoryInfo();

            assertThat(mem.getTotalBytes()).isEqualTo(8065536L * 1024);
            assertThat(mem.getSwapTotalBytes()).isEqualTo(2097152L * 1024);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // /sys/class/thermal + /sys/class/hwmon
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Temperature {

        @Test
        void thermalZonesAreReadInOrderAndScaledFromMilliCelsius() throws IOException {
            writeFile("/sys/class/thermal/thermal_zone0/temp", "48312");
            writeFile("/sys/class/thermal/thermal_zone0/type", "cpu-thermal");
            writeFile("/sys/class/thermal/thermal_zone1/temp", "61500");
            writeFile("/sys/class/thermal/thermal_zone1/type", "gpu-thermal");

            TemperatureInfo info = collector.getTemperatureInfo();

            assertThat(info.getSensors()).extracting(TemperatureSensor::getName)
                    .containsExactly("cpu-thermal", "gpu-thermal");
            assertThat(info.getSensors().get(0).getTemperatureCelsius()).isEqualTo(48.312);
            assertThat(info.getSensors().get(0).getTemperatureFahrenheit()).isCloseTo(118.96, within(0.01));
            assertThat(info.getMaxTemperatureCelsius()).isEqualTo(61.5);
            assertThat(info.getHasTemperatureSensors()).isTrue();
        }

        @Test
        void zoneWithoutTypeFallsBackToTheDirectoryName() throws IOException {
            writeFile("/sys/class/thermal/thermal_zone0/temp", "40000");

            TemperatureInfo info = collector.getTemperatureInfo();

            assertThat(info.getSensors()).singleElement()
                    .satisfies(s -> assertThat(s.getName()).isEqualTo("thermal_zone0"));
        }

        @Test
        void nonZoneEntriesUnderThermalAreIgnored() throws IOException {
            writeFile("/sys/class/thermal/cooling_device0/type", "pwm-fan");
            writeFile("/sys/class/thermal/thermal_zone0/temp", "40000");
            writeFile("/sys/class/thermal/thermal_zone0/type", "cpu-thermal");

            TemperatureInfo info = collector.getTemperatureInfo();

            assertThat(info.getSensors()).extracting(TemperatureSensor::getName).containsExactly("cpu-thermal");
        }

        @Test
        void statusThresholdsAreNormalWarmHigh() throws IOException {
            writeFile("/sys/class/thermal/thermal_zone0/temp", "55000");   // OK
            writeFile("/sys/class/thermal/thermal_zone0/type", "cool");
            writeFile("/sys/class/thermal/thermal_zone1/temp", "70000");   // WARM
            writeFile("/sys/class/thermal/thermal_zone1/type", "warm");
            writeFile("/sys/class/thermal/thermal_zone2/temp", "85000");   // HIGH
            writeFile("/sys/class/thermal/thermal_zone2/type", "hot");

            TemperatureInfo info = collector.getTemperatureInfo();

            assertThat(info.getSensors()).extracting(TemperatureSensor::getStatus)
                    .containsExactly("OK", "WARM", "HIGH");
            assertThat(info.getStatus()).isEqualTo("HIGH");
        }

        @Test
        void hwmonContributesTemperaturesAndFanSpeeds() throws IOException {
            writeFile("/sys/class/hwmon/hwmon0/name", "cpu_thermal");
            writeFile("/sys/class/hwmon/hwmon0/temp1_input", "52000");
            writeFile("/sys/class/hwmon/hwmon0/temp1_label", "Package id 0");
            writeFile("/sys/class/hwmon/hwmon0/fan1_input", "2400");
            writeFile("/sys/class/hwmon/hwmon0/fan2_input", "0");

            TemperatureInfo info = collector.getTemperatureInfo();

            assertThat(info.getSensors()).singleElement()
                    .satisfies(s -> assertThat(s.getName()).isEqualTo("cpu_thermal Package id 0"));

            assertThat(info.getFanSensors()).hasSize(2);
            assertThat(info.getFanSensors().get(0)).containsEntry("rpm", 2400L).containsEntry("status", "RUNNING");
            assertThat(info.getFanSensors().get(1)).containsEntry("rpm", 0L).containsEntry("status", "STOPPED");
        }

        @Test
        void hwmonScanStopsAtTheFirstGapInTheInputNumbering() throws IOException {
            // temp2_input is absent, so temp3_input must never be reached — the loop breaks
            // rather than continuing. Pinning this because the numbering is 1-based and
            // contiguous on real hardware; a "fix" to skip gaps would change what gets reported.
            writeFile("/sys/class/hwmon/hwmon0/name", "acpitz");
            writeFile("/sys/class/hwmon/hwmon0/temp1_input", "40000");
            writeFile("/sys/class/hwmon/hwmon0/temp3_input", "90000");

            TemperatureInfo info = collector.getTemperatureInfo();

            assertThat(info.getSensors()).hasSize(1);
            assertThat(info.getMaxTemperatureCelsius()).isEqualTo(40.0);
        }

        @Test
        void sensorsCommandSupplementsButDoesNotDuplicateSysfsReadings() throws IOException {
            writeFile("/sys/class/thermal/thermal_zone0/temp", "48000");
            writeFile("/sys/class/thermal/thermal_zone0/type", "cpu-thermal");
            cannedCommands.put("sensors", """
                    cpu-thermal
                    cpu-thermal:  +99.0°C
                    nvme-pci-0100:  +35.9°C
                    """);

            TemperatureInfo info = collector.getTemperatureInfo();

            // "cpu-thermal" already came from sysfs, so the lm-sensors duplicate is dropped
            // and its (higher) reading must not move the max.
            assertThat(info.getSensors()).extracting(TemperatureSensor::getName)
                    .containsExactly("cpu-thermal", "nvme-pci-0100");
            assertThat(info.getMaxTemperatureCelsius()).isEqualTo(48.0);
        }

        @Test
        void noSensorsAnywhereReportsAbsenceRatherThanFailing() {
            TemperatureInfo info = collector.getTemperatureInfo();

            assertThat(info.getSensors()).isEmpty();
            assertThat(info.getHasTemperatureSensors()).isFalse();
            assertThat(info.getMaxTemperatureCelsius()).isZero();
            assertThat(info.getStatus()).isEqualTo("NORMAL");
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // /proc/net/dev
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class NetDev {

        private static final String NET_DEV = """
                Inter-|   Receive                                                |  Transmit
                 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
                    lo: 1000000    1000    0    0    0     0          0         0  1000000    1000    0    0    0     0       0          0
                  eth0: 8123456   54321   7    3    0     0          0       120  2345678   43210   2    1    0     0       0          0
                 wlan0:  512000    4096   0    0    0     0          0         0   256000    2048   0    0    0     0       0          0
                """;

        @Test
        void loopbackIsExcludedAndFieldsLandInTheDocumentedSlots() throws IOException {
            writeFile("/proc/net/dev", NET_DEV);

            Map<String, long[]> stats = collector.readNetDevStats();

            assertThat(stats).containsOnlyKeys("eth0", "wlan0");
            // Slot 0 = rx bytes, slot 2 = rx errors, slot 8 = tx bytes, slot 10 = tx errors.
            // getNetworkInfo/getPerformanceMetrics index these positionally.
            assertThat(stats.get("eth0")[0]).isEqualTo(8123456L);
            assertThat(stats.get("eth0")[2]).isEqualTo(7L);
            assertThat(stats.get("eth0")[8]).isEqualTo(2345678L);
            assertThat(stats.get("eth0")[10]).isEqualTo(2L);
        }

        @Test
        void headerLinesWithoutAColonAreSkipped() throws IOException {
            writeFile("/proc/net/dev", NET_DEV);

            assertThat(collector.readNetDevStats()).doesNotContainKey("Inter-|   Receive");
        }

        @Test
        void missingNetDevYieldsAnEmptyMapRatherThanThrowing() {
            assertThat(collector.readNetDevStats()).isEmpty();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // /proc/uptime + /proc/loadavg
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Performance {

        @Test
        void loadAveragesAndProcessCountsAreParsed() throws IOException {
            writeFile("/proc/uptime", "349851.24 1315678.90");
            writeFile("/proc/loadavg", "0.52 0.41 0.38 3/412 98765");
            writeFile("/proc/meminfo", """
                    MemTotal:        8065536 kB
                    MemAvailable:    6291456 kB
                    """);

            PerformanceMetrics perf = collector.getPerformanceMetrics();

            assertThat(perf.getCpuLoad1Min()).isEqualTo(0.52);
            assertThat(perf.getCpuLoad5Min()).isEqualTo(0.41);
            assertThat(perf.getCpuLoad15Min()).isEqualTo(0.38);
            // "3/412" is running/total, not a fraction.
            assertThat(perf.getRunningProcessCount()).isEqualTo(3);
            assertThat(perf.getProcessCount()).isEqualTo(412);
            assertThat(perf.getUptimeSeconds()).isEqualTo(349851L);
            assertThat(perf.getUptime()).isEqualTo("4d 1h 10m 51s");
            assertThat(perf.getMemoryLoadPercent()).isCloseTo(22.0, within(0.05));
        }

        @Test
        void firstSampleReportsZeroNetworkSpeedBecauseThereIsNoPreviousReading() throws IOException {
            writeFile("/proc/uptime", "100.0 200.0");
            writeFile("/proc/loadavg", "0.0 0.0 0.0 1/100 123");
            writeFile("/proc/net/dev", """
                      eth0: 8123456   54321   0    0    0     0          0         0  2345678   43210   0    0    0     0       0          0
                    """);

            PerformanceMetrics perf = collector.getPerformanceMetrics();

            // The delta is computed against a cached prior sample; on the first call there
            // isn't one, so speed must read 0 rather than the cumulative counter.
            assertThat(perf.getNetworkRxBytesPerSec()).isZero();
            assertThat(perf.getNetworkTxBytesPerSec()).isZero();
            assertThat(perf.getNetworkRxFormatted()).isEqualTo("0 B/s");
        }

        @Test
        void uptimeFormattingDropsZeroValuedLeadingUnits() throws IOException {
            writeFile("/proc/uptime", "125.00 250.00");
            writeFile("/proc/loadavg", "0.0 0.0 0.0 1/100 123");

            assertThat(collector.getPerformanceMetrics().getUptime()).isEqualTo("2m 5s");
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // /proc/cpuinfo
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class CpuInfo_ {

        @Test
        void x86CpuinfoSuppliesModelVendorAndCache() throws IOException {
            writeFile("/proc/cpuinfo", """
                    processor       : 0
                    vendor_id       : GenuineIntel
                    model name      : Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz
                    cpu MHz         : 2592.000
                    cache size      : 12288 KB
                    flags           : fpu vme de pse tsc msr pae mce
                    """);

            CpuInfo cpu = collector.getCpuInfo();

            assertThat(cpu.getName()).isEqualTo("Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz");
            assertThat(cpu.getVendor()).isEqualTo("GenuineIntel");
            assertThat(cpu.getClockSpeedMhz()).isEqualTo(2592.0);
            assertThat(cpu.getCacheSize()).isEqualTo("12288 KB");
        }

        @Test
        void aarch64CpuinfoWithoutModelNameFallsBackToUnknown() throws IOException {
            // /proc/cpuinfo on ARM has no "model name"/"vendor_id" — this fallback is what
            // RaspberryPiServerInfoCollector.getCpuInfo() detects and then augments.
            writeFile("/proc/cpuinfo", """
                    processor       : 0
                    BogoMIPS        : 108.00
                    Features        : fp asimd evtstrm aes pmull sha1 sha2 crc32
                    CPU implementer : 0x41
                    """);

            CpuInfo cpu = collector.getCpuInfo();

            assertThat(cpu.getName()).isEqualTo("Unknown");
            assertThat(cpu.getVendor()).isEqualTo("Unknown");
            assertThat(cpu.getClockSpeedMhz()).isZero();
        }

        @Test
        void cpuFlagsAreReadFromEitherFlagsOrArmFeatures() throws IOException {
            writeFile("/proc/cpuinfo", """
                    processor       : 0
                    Features        : fp asimd evtstrm aes pmull
                    """);

            assertThat(collector.getCpuFlags()).containsExactly("fp", "asimd", "evtstrm", "aes", "pmull");
        }

        @Test
        void missingCpuinfoYieldsNoFlags() {
            assertThat(collector.getCpuFlags()).isEmpty();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // /sys/class/dmi/id + /proc/version
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class ServerAndBios {

        @Test
        void serverInfoPrefersPrettyNameAndTakesTheThirdTokenOfProcVersion() throws IOException {
            writeFile("/proc/version", "Linux version 6.8.0-45-generic (buildd@lcy02) #45-Ubuntu SMP");
            writeFile("/sys/class/dmi/id/sys_vendor", "Dell Inc.");
            writeFile("/sys/class/dmi/id/product_name", "OptiPlex 7070");
            cannedCommands.put("cat", """
                    PRETTY_NAME="Ubuntu 24.04.1 LTS"
                    NAME="Ubuntu"
                    VERSION_ID="24.04"
                    """);

            ServerInfo info = collector.getServerInfo();

            assertThat(info.getOsName()).isEqualTo("Ubuntu 24.04.1 LTS");
            assertThat(info.getOsVersion()).isEqualTo("24.04");
            assertThat(info.getKernelVersion()).isEqualTo("6.8.0-45-generic");
            assertThat(info.getManufacturer()).isEqualTo("Dell Inc.");
            assertThat(info.getModel()).isEqualTo("OptiPlex 7070");
        }

        @Test
        void biosReadsDmiWithoutShellingOutWhenSysfsIsPopulated() throws IOException {
            writeFile("/sys/class/dmi/id/bios_vendor", "Dell Inc.");
            writeFile("/sys/class/dmi/id/bios_version", "1.21.0");
            writeFile("/sys/class/dmi/id/bios_date", "03/14/2024");
            writeFile("/sys/class/dmi/id/board_name", "0K1KDX");
            writeFile("/sys/class/dmi/id/board_version", "A00");

            BiosInfo bios = collector.getBiosInfo();

            assertThat(bios.getVendor()).isEqualTo("Dell Inc.");
            assertThat(bios.getVersion()).isEqualTo("1.21.0");
            assertThat(bios.getReleaseDate()).isEqualTo("03/14/2024");
            assertThat(bios.getFirmwareRevision()).isEqualTo("0K1KDX vA00");
        }

        @Test
        void biosFallsBackToDmidecodeWhenSysfsVendorIsAbsent() {
            cannedCommands.put("dmidecode", """
                    BIOS Information
                    \tVendor: American Megatrends Inc.
                    \tVersion: F31
                    \tRelease Date: 09/12/2023
                    """);

            BiosInfo bios = collector.getBiosInfo();

            assertThat(bios.getVendor()).isEqualTo("American Megatrends Inc.");
            assertThat(bios.getVersion()).isEqualTo("F31");
            assertThat(bios.getReleaseDate()).isEqualTo("09/12/2023");
        }

        @Test
        void absentBiosSourcesReportNotAvailableRatherThanEmptyStrings() {
            BiosInfo bios = collector.getBiosInfo();

            assertThat(bios.getVendor()).isEqualTo("N/A");
            assertThat(bios.getVersion()).isEqualTo("N/A");
            assertThat(bios.getReleaseDate()).isEqualTo("N/A");
        }

        @Test
        void dmiInfoOmitsFieldsThatAreNotPresent() throws IOException {
            writeFile("/sys/class/dmi/id/sys_vendor", "Raspberry Pi Foundation");
            writeFile("/sys/class/dmi/id/board_name", "BCM2712");

            Map<String, String> dmi = collector.getDmiInfo();

            assertThat(dmi).containsOnlyKeys("sys_vendor", "board_name");
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // /etc/resolv.conf + ip route
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class NetworkLookups {

        @Test
        void resolvConfSuppliesDnsServersAndSearchDomainWhenResolvectlIsUnavailable() throws IOException {
            writeFile("/etc/resolv.conf", """
                    # Generated by NetworkManager
                    search lan
                    nameserver 192.168.1.1
                    nameserver 1.1.1.1
                    """);
            writeFile("/proc/net/dev", "");
            cannedCommands.put("ip", "default via 192.168.1.1 dev eth0 proto dhcp metric 100");

            NetworkInfo net = collector.getNetworkInfo();

            assertThat(net.getDnsServers()).containsExactly("192.168.1.1", "1.1.1.1");
            assertThat(net.getDomain()).isEqualTo("lan");
            assertThat(net.getDefaultGateway()).isEqualTo("192.168.1.1");
        }

        @Test
        void resolvectlOutputWinsOverResolvConf() throws IOException {
            writeFile("/etc/resolv.conf", "nameserver 127.0.0.53\n");
            writeFile("/proc/net/dev", "");
            cannedCommands.put("resolvectl", """
                    Global
                    Link 2 (eth0)
                         DNS Servers: 192.168.1.1 8.8.8.8
                    """);

            NetworkInfo net = collector.getNetworkInfo();

            // 127.0.0.53 is the systemd-resolved stub, not a real upstream — resolvectl
            // reports the actual servers and must take precedence.
            assertThat(net.getDnsServers()).containsExactly("192.168.1.1", "8.8.8.8");
        }

        @Test
        void adapterStatusComesFromOperstateAndIsCapitalized() throws IOException {
            writeFile("/proc/net/dev", """
                      eth0: 100 1 0 0 0 0 0 0 200 2 0 0 0 0 0 0
                     wlan0: 300 3 0 0 0 0 0 0 400 4 0 0 0 0 0 0
                    """);
            writeFile("/sys/class/net/eth0/operstate", "up");
            writeFile("/sys/class/net/wlan0/operstate", "dormant");

            NetworkInfo net = collector.getNetworkInfo();

            assertThat(net.getAdapters()).extracting(NetworkAdapter::getName, NetworkAdapter::getStatus)
                    .containsExactly(tuple("eth0", "Up"), tuple("wlan0", "Dormant"));
        }

        @Test
        void missingOperstateLeavesStatusNullRatherThanGuessing() throws IOException {
            writeFile("/proc/net/dev", "  eth0: 100 1 0 0 0 0 0 0 200 2 0 0 0 0 0 0\n");

            NetworkInfo net = collector.getNetworkInfo();

            assertThat(net.getAdapters()).singleElement()
                    .satisfies(a -> assertThat(a.getStatus()).isNull());
        }

        @Test
        void noResolvConfAndNoResolvectlReportsNullNotAnEmptyList() throws IOException {
            writeFile("/proc/net/dev", "  eth0: 100 1 0 0 0 0 0 0 200 2 0 0 0 0 0 0\n");

            NetworkInfo net = collector.getNetworkInfo();

            assertThat(net.getDnsServers()).isNull();
            assertThat(net.getDefaultGateway()).isNull();
            // No operstate file either — status stays null rather than being guessed as "Up".
            assertThat(net.getAdapters()).singleElement()
                    .satisfies(a -> assertThat(a.getStatus()).isNull());
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // lsblk / df (exec seam, no filesystem fixture needed)
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Disks {

        @Test
        void lsblkPartitionsAreWalkedRecursivelyAndOnlyMountedOnesAreReported() {
            cannedCommands.put("lsblk", """
                    {
                       "blockdevices": [
                          {"name":"sda","size":"512110190592","type":"disk","mountpoint":null,"tran":"sata",
                           "children":[
                              {"name":"sda1","size":"536870912","type":"part","mountpoint":"%s","fstype":"vfat","label":"BOOT"},
                              {"name":"sda2","size":"511573319680","type":"part","mountpoint":null,"fstype":"ext4"}
                           ]}
                       ]
                    }
                    """.formatted(root.toString().replace("\\", "/")));

            DiskInfo disk = collector.getDiskInfo();

            // sda itself and sda2 have no mountpoint, so only sda1 becomes a drive.
            assertThat(disk.getDrives()).singleElement().satisfies(d -> {
                assertThat(d.getDevice()).isEqualTo("/dev/sda1");
                assertThat(d.getFileSystem()).isEqualTo("vfat");
                assertThat(d.getLabel()).isEqualTo("BOOT");
            });
            assertThat(disk.getDriveCount()).isEqualTo(1);
        }

        @Test
        void usbTransportIsLabelledAsExternal() {
            cannedCommands.put("lsblk", """
                    {"blockdevices":[
                       {"name":"sdb1","size":"1000204886016","type":"part","mountpoint":"%s",
                        "fstype":"ext4","tran":"usb","rm":true,"hotplug":true,"vendor":"Seagate ","model":"Expansion "}
                    ]}
                    """.formatted(root.toString().replace("\\", "/")));

            DiskInfo disk = collector.getDiskInfo();

            assertThat(disk.getDrives()).singleElement().satisfies(d -> {
                assertThat(d.getType()).isEqualTo("External (usb)");
                assertThat(d.getRemovable()).isTrue();
                assertThat(d.getVendor()).isEqualTo("Seagate");
                assertThat(d.getModel()).isEqualTo("Expansion");
            });
        }

        @Test
        void dfIsUsedWhenLsblkProducesNothing() {
            cannedCommands.put("df", """
                    Filesystem          1B-blocks         Used        Avail Use% Mounted on   Type
                    /dev/sda2         511573319680  20000000000  491573319680   4% /            ext4
                    tmpfs                4194304000            0    4194304000   0% /dev/shm    tmpfs
                    """);

            DiskInfo disk = collector.getDiskInfo();

            assertThat(disk.getDrives()).hasSize(2);
            assertThat(disk.getDrives().get(0).getDevice()).isEqualTo("/dev/sda2");
            assertThat(disk.getDrives().get(0).getMountPoint()).isEqualTo("/");
            assertThat(disk.getDrives().get(0).getUsedPercent()).isEqualTo("4");
            assertThat(disk.getTotalSpace()).isEqualTo(511573319680L + 4194304000L);
        }

        @Test
        void malformedLsblkJsonDegradesToAnEmptyDriveListRatherThanThrowing() {
            cannedCommands.put("lsblk", "{not json");

            DiskInfo disk = collector.getDiskInfo();

            assertThat(disk.getDrives()).isEmpty();
            assertThat(disk.getTotalSpace()).isZero();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ps / lsusb / lspci / dpkg-query (exec seam)
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class CommandDrivenParsers {

        @Test
        void psOutputIsParsedSortedByCpuAndCappedAtFifty() {
            StringBuilder ps = new StringBuilder();
            for (int i = 1; i <= 60; i++) {
                ps.append("user%d %d %d.0 1.5 123456 %d ? Ss 09:15 0:01 /usr/bin/proc%d --flag\n"
                        .formatted(i, 1000 + i, i, 2048 * i, i));
            }
            cannedCommands.put("ps", ps.toString());

            List<ProcessInfo> procs = collector.getRunningProcesses();

            assertThat(procs).hasSize(50);
            assertThat(procs.get(0).getCpuUsage()).isEqualTo(60.0);
            assertThat(procs.get(0).getName()).isEqualTo("proc60");
            assertThat(procs.get(0).getMemoryBytes()).isEqualTo(2048L * 60 * 1024);
        }

        @Test
        void processNameStripsArgumentsAndTheDirectoryPrefix() {
            // The interpreter case is the one that used to break: the old code checked the
            // whole command line for "/", so "python3 /opt/app/main.py" was named after its
            // script argument, and "/usr/bin/proc --flag" kept the flag in its name.
            cannedCommands.put("ps", """
                    root  1 0.1 0.5 12345 6789 ? Ss 09:15 0:03 kthreadd --opt
                    root  2 0.1 0.5 12345 6789 ? Ss 09:15 0:03 /usr/lib/systemd/systemd-journald
                    dbw   3 0.1 0.5 12345 6789 ? Ss 09:15 0:03 /usr/bin/proc --flag
                    dbw   4 0.1 0.5 12345 6789 ? Ss 09:15 0:03 python3 /opt/app/main.py
                    """);

            assertThat(collector.getRunningProcesses()).extracting(ProcessInfo::getName)
                    .containsExactlyInAnyOrder("kthreadd", "systemd-journald", "proc", "python3");
        }

        @Test
        void commandLineKeepsTheFullArgumentsEvenThoughTheNameDoesNot() {
            cannedCommands.put("ps", "dbw 3 0.1 0.5 12345 6789 ? Ss 09:15 0:03 /usr/bin/proc --flag\n");

            assertThat(collector.getRunningProcesses()).singleElement()
                    .satisfies(p -> {
                        assertThat(p.getName()).isEqualTo("proc");
                        assertThat(p.getCommandLine()).isEqualTo("/usr/bin/proc --flag");
                    });
        }

        @Test
        void perUserStatsAggregateCpuAndMemoryAcrossProcesses() {
            cannedCommands.put("ps", """
                    alice 1001 10.0 1.0 100 1024 ? Ss 09:15 0:01 /usr/bin/a
                    alice 1002 5.0 0.5 100 2048 ? Ss 09:15 0:01 /usr/bin/b
                    bob   2001 1.0 0.1 100 512  ? Ss 09:15 0:01 /usr/bin/c
                    """);

            Map<String, Map<String, Object>> stats = collector.getPerUserProcessStats();

            assertThat(stats.get("alice")).containsEntry("processCount", 2)
                    .containsEntry("totalCpuPct", 15.0)
                    .containsEntry("totalMemBytes", 3072L * 1024);
            assertThat(stats.get("bob")).containsEntry("processCount", 1);
        }

        @Test
        void dpkgQuerySkipsPackagesThatAreNotInstalled() {
            cannedCommands.put("dpkg-query", """
                    nginx\t1.24.0-2ubuntu7\tamd64\tinstall ok installed
                    ffmpeg\t7:6.1.1-3\tamd64\tdeinstall ok config-files
                    curl\t8.5.0-2ubuntu10\tamd64\tinstall ok installed
                    """);

            assertThat(collector.getInstalledPackages()).hasSize(2);
        }

        @Test
        void lsusbLinesAreSplitIntoBusDeviceAndId() {
            cannedCommands.put("lsusb", "Bus 001 Device 002: ID 1d6b:0002 Linux Foundation 2.0 root hub\n");

            assertThat(collector.getUsbDevices()).singleElement().satisfies(d -> {
                assertThat(d).containsEntry("bus", "001");
                assertThat(d).containsEntry("device", "002");
                assertThat(d).containsEntry("id", "1d6b:0002");
            });
        }

        @Test
        void lsmodSkipsItsHeaderRow() {
            cannedCommands.put("lsmod", """
                    Module                  Size  Used by
                    bluetooth            1044480  0
                    snd_soc_core          389120  1
                    """);

            assertThat(collector.getLoadedKernelModules()).containsExactly("bluetooth", "snd_soc_core");
        }
    }
}
