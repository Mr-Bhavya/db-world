package com.db.dbworld.app.system.info.collector.linux;

import com.db.dbworld.app.system.info.dto.*;
import com.db.dbworld.app.system.info.dto.os.linux.PackageInfo;
import com.db.dbworld.app.system.info.dto.os.raspberrypi.*;
import com.db.dbworld.core.processor.ProcessExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.Mockito.mock;

/**
 * Drives the Raspberry Pi collector's device-tree, /proc, /sys and config.txt parsers off a
 * fixture filesystem tree, via the {@code fsRoot()} seam, plus canned vcgencmd output via the
 * {@code exec(...)} seam.
 *
 * <p>Fixtures use the real on-disk formats, tabs included — {@code /proc/cpuinfo} pads its
 * keys out with tabs, and that detail is exactly what the revision parser used to trip over.
 */
class RaspberryPiServerInfoCollectorParseTest {

    private static final String VCGENCMD = "/usr/bin/vcgencmd";

    /** Real aarch64 /proc/cpuinfo shape: keys padded with tabs before the colon. */
    private static final String PI5_CPUINFO = """
            processor\t: 0
            BogoMIPS\t: 108.00
            Features\t: fp asimd evtstrm aes pmull sha1 sha2 crc32
            CPU implementer\t: 0x41
            CPU architecture: 8
            Hardware\t: BCM2835
            Revision\t: c03111
            Serial\t\t: 100000004f3a2a1b
            Model\t\t: Raspberry Pi 5 Model B Rev 1.0
            """;

    @TempDir
    Path root;

    private final Map<String, String> cannedCommands = new HashMap<>();

    private RaspberryPiServerInfoCollector collector;

    @BeforeEach
    void setUp() {
        cannedCommands.clear();
        collector = new RaspberryPiServerInfoCollector(mock(ProcessExecutor.class)) {
            @Override
            protected Path fsRoot() {
                return root;
            }

            @Override
            protected String exec(int timeoutSeconds, String... command) {
                if (command.length == 0) return "";
                // Exact match on the whole command first (vcgencmd has many subcommands),
                // then fall back to the executable name for commands with noisy arguments.
                String joined = String.join(" ", command);
                return cannedCommands.containsKey(joined)
                        ? cannedCommands.get(joined)
                        : cannedCommands.getOrDefault(command[0], "");
            }
        };
    }

    private void writeFile(String absolutePath, String content) throws IOException {
        Path target = root.resolve(absolutePath.startsWith("/") ? absolutePath.substring(1) : absolutePath);
        Files.createDirectories(target.getParent());
        Files.writeString(target, content);
    }

    private void writeModel(String model) throws IOException {
        writeFile("/proc/device-tree/model", model);
    }

    /** getGpioInfo() only shells out to raspi-gpio once it sees a GPIO character device. */
    private void makeGpioAccessible() throws IOException {
        writeFile("/dev/gpiochip0", "");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Device-tree model → SoC / processor
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class BoardIdentification {

        @Test
        void pi5MapsToBcm2712AndCortexA76() throws IOException {
            writeModel("Raspberry Pi 5 Model B Rev 1.0");

            RaspberryPiInfo info = collector.getRaspberryPiInfo();

            assertThat(info.getIsRaspberryPi()).isTrue();
            assertThat(info.getSoc()).isEqualTo("BCM2712");
            assertThat(info.getProcessor()).isEqualTo("Cortex-A76");
            assertThat(info.getMaker()).isEqualTo("Raspberry Pi Foundation");
        }

        @Test
        void pi4MapsToBcm2711AndCortexA72() throws IOException {
            writeModel("Raspberry Pi 4 Model B Rev 1.1");

            RaspberryPiInfo info = collector.getRaspberryPiInfo();

            assertThat(info.getSoc()).isEqualTo("BCM2711");
            assertThat(info.getProcessor()).isEqualTo("Cortex-A72");
        }

        @Test
        void pi3BPlusIsDistinguishedFromPlainPi3() throws IOException {
            writeModel("Raspberry Pi 3 Model B+ Rev 1.3");

            assertThat(collector.getRaspberryPiInfo().getSoc()).isEqualTo("BCM2837B0");
        }

        @Test
        void plainPi3MapsToBcm2837() throws IOException {
            writeModel("Raspberry Pi 3 Model B Rev 1.2");

            RaspberryPiInfo info = collector.getRaspberryPiInfo();

            assertThat(info.getSoc()).isEqualTo("BCM2837");
            assertThat(info.getProcessor()).isEqualTo("Cortex-A53");
        }

        @Test
        void piZeroMapsToBcm2835() throws IOException {
            writeModel("Raspberry Pi Zero 2 W Rev 1.0");

            RaspberryPiInfo info = collector.getRaspberryPiInfo();

            assertThat(info.getSoc()).isEqualTo("BCM2835");
            assertThat(info.getProcessor()).isEqualTo("ARM1176JZF-S");
        }

        @Test
        void unrecognisedModelKeepsTheRawStringWithoutInventingASoc() throws IOException {
            writeModel("Some Other SBC v2");

            RaspberryPiInfo info = collector.getRaspberryPiInfo();

            assertThat(info.getModel()).isEqualTo("Some Other SBC v2");
            assertThat(info.getSoc()).isNull();
            assertThat(info.getProcessor()).isNull();
        }

        @Test
        void missingDeviceTreeLeavesModelUnsetRatherThanBlank() {
            RaspberryPiInfo info = collector.getRaspberryPiInfo();

            assertThat(info.getModel()).isNull();
            assertThat(info.getSoc()).isNull();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // /proc/cpuinfo — the tab-padded key regression
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class CpuInfoFields {

        @Test
        void revisionAndHardwareAreReadDespiteTabPaddingBeforeTheColon() throws IOException {
            // Regression: the old parser required "Revision:" flush against the key, so on a
            // real Pi (where the line is "Revision\t: c03111") revision, hardware and
            // boardVersion were all silently null.
            writeModel("Raspberry Pi 5 Model B Rev 1.0");
            writeFile("/proc/cpuinfo", PI5_CPUINFO);

            RaspberryPiInfo info = collector.getRaspberryPiInfo();

            assertThat(info.getRevision()).isEqualTo("c03111");
            assertThat(info.getHardware()).isEqualTo("BCM2835");
        }

        @Test
        void boardVersionIsTheLowNibbleOfTheHexRevision() throws IOException {
            writeModel("Raspberry Pi 5 Model B Rev 1.0");
            writeFile("/proc/cpuinfo", PI5_CPUINFO);

            // 0xc03111 & 0x0F == 1
            assertThat(collector.getRaspberryPiInfo().getBoardVersion()).isEqualTo(1);
        }

        @Test
        void aKnownRevisionCodeOverridesTheDeviceTreeModel() throws IOException {
            // c03111 is the documented code for a 4GB Pi 4; the lookup deliberately wins over
            // the device-tree string because it carries the RAM size the model string lacks.
            writeModel("Raspberry Pi 4 Model B Rev 1.1");
            writeFile("/proc/cpuinfo", PI5_CPUINFO);

            assertThat(collector.getRaspberryPiInfo().getModel()).isEqualTo("Pi 4 4GB");
        }

        @Test
        void anUnknownRevisionCodeLeavesTheDeviceTreeModelIntact() throws IOException {
            writeModel("Raspberry Pi 5 Model B Rev 1.0");
            writeFile("/proc/cpuinfo", "Revision\t: d04170\nHardware\t: BCM2835\n");

            RaspberryPiInfo info = collector.getRaspberryPiInfo();

            assertThat(info.getRevision()).isEqualTo("d04170");
            assertThat(info.getModel()).isEqualTo("Raspberry Pi 5 Model B Rev 1.0");
        }

        @Test
        void memTotalIsConvertedFromKilobytesToMegabytes() throws IOException {
            writeModel("Raspberry Pi 5 Model B Rev 1.0");
            writeFile("/proc/meminfo", "MemTotal:        8065536 kB\nMemFree:  1048576 kB\n");

            // 8065536 kB / 1024 == 7876 MB
            assertThat(collector.getRaspberryPiInfo().getMemoryMB()).isEqualTo(7876);
        }

        @Test
        void aNonHexRevisionDoesNotAbortTheRestOfTheCollection() throws IOException {
            writeModel("Raspberry Pi 5 Model B Rev 1.0");
            writeFile("/proc/cpuinfo", "Revision\t: not-hex\nHardware\t: BCM2712\n");

            RaspberryPiInfo info = collector.getRaspberryPiInfo();

            assertThat(info.getBoardVersion()).isNull();
            // Hardware is read before the failing parse and must survive it.
            assertThat(info.getHardware()).isEqualTo("BCM2712");
            assertThat(info.getSoc()).isEqualTo("BCM2712");
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CPU augmentation over the generic Linux reading
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class CpuAugmentation {

        private static final String PROC_STAT = """
                cpu  123456 789 34567 890123 4567 0 890 0 0 0
                cpu0 30000 200 8000 220000 1100 0 200 0 0 0
                cpu1 31000 190 8500 221000 1150 0 220 0 0 0
                """;

        @Test
        void unknownCpuNameIsFilledFromTheDeviceTreeModel() throws IOException {
            // /proc/cpuinfo on ARM has no "model name"/"vendor_id", so the generic Linux
            // parser yields "Unknown" and the Pi collector derives real labels instead.
            writeModel("Raspberry Pi 5 Model B Rev 1.0");
            writeFile("/proc/cpuinfo", PI5_CPUINFO);

            CpuInfo cpu = collector.getCpuInfo();

            assertThat(cpu.getName()).isEqualTo("Cortex-A76");
            assertThat(cpu.getVendor()).isEqualTo("Broadcom BCM2712");
        }

        @Test
        void anUnknownBoardIsLeftUnknownRatherThanGivenAFabricatedName() throws IOException {
            writeModel("Some Other SBC v2");
            writeFile("/proc/cpuinfo", PI5_CPUINFO);

            CpuInfo cpu = collector.getCpuInfo();

            assertThat(cpu.getName()).isEqualTo("Unknown");
            assertThat(cpu.getVendor()).isEqualTo("Unknown");
        }

        @Test
        void theDerivedVendorIsPropagatedToEveryCore() throws IOException {
            writeModel("Raspberry Pi 4 Model B Rev 1.1");
            writeFile("/proc/cpuinfo", PI5_CPUINFO);
            writeFile("/proc/stat", PROC_STAT);

            CpuInfo cpu = collector.getCpuInfo();

            assertThat(cpu.getCoreDetails()).hasSize(2)
                    .allSatisfy(c -> assertThat(c.getVendor()).isEqualTo("Broadcom BCM2711"));
        }

        @Test
        void vcgencmdClockOverlaysTheCurrentAndMaxFrequency() throws IOException {
            writeModel("Raspberry Pi 5 Model B Rev 1.0");
            writeFile("/proc/cpuinfo", PI5_CPUINFO);
            cannedCommands.put(VCGENCMD + " measure_clock arm", "frequency(0)=2400000000");

            CpuInfo cpu = collector.getCpuInfo();

            assertThat(cpu.getCurrentFrequency()).isEqualTo(2_400_000_000L);
            assertThat(cpu.getMaxFrequency()).isEqualTo(2_400_000_000L);
        }

        @Test
        void configTxtArmFreqIsTheFallbackWhenVcgencmdIsUnavailable() throws IOException {
            writeModel("Raspberry Pi 5 Model B Rev 1.0");
            writeFile("/proc/cpuinfo", PI5_CPUINFO);
            writeFile("/boot/config.txt", "arm_freq=2800\nover_voltage=6\n");

            CpuInfo cpu = collector.getCpuInfo();

            // config.txt is in MHz, the DTO in Hz.
            assertThat(cpu.getCurrentFrequency()).isEqualTo(2_800_000_000L);
        }

        @Test
        void neitherSourceLeavesTheFrequencyUntouched() throws IOException {
            writeModel("Raspberry Pi 5 Model B Rev 1.0");
            writeFile("/proc/cpuinfo", PI5_CPUINFO);

            assertThat(collector.getCpuInfo().getCurrentFrequency()).isNull();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Temperature + throttling
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Temperature {

        @Test
        void cpuTemperatureIsScaledFromMilliCelsiusAndConvertedToFahrenheit() throws IOException {
            writeFile("/sys/class/thermal/thermal_zone0/temp", "48312");

            TemperatureInfo info = collector.getTemperatureInfo();

            assertThat(info.getSensors()).singleElement().satisfies(s -> {
                assertThat(s.getName()).isEqualTo("CPU Temperature");
                assertThat(s.getTemperatureCelsius()).isEqualTo(48.312);
                assertThat(s.getTemperatureFahrenheit()).isCloseTo(118.96, within(0.01));
                assertThat(s.getStatus()).isEqualTo("Normal");
                assertThat(s.getHighThreshold()).isEqualTo(80.0);
            });
            assertThat(info.getHighestSensor()).isEqualTo("CPU");
        }

        @Test
        void gpuZoneRaisesTheHighestReadingWhenItIsHotterThanTheCpu() throws IOException {
            writeFile("/sys/class/thermal/thermal_zone0/temp", "48000");
            writeFile("/sys/class/thermal/thermal_zone1/temp", "51000");

            TemperatureInfo info = collector.getTemperatureInfo();

            assertThat(info.getSensors()).hasSize(2);
            assertThat(info.getHighestSensor()).isEqualTo("GPU");
            assertThat(info.getHighestTemperatureCelsius()).isEqualTo(51.0);
            assertThat(info.getAverageTemperatureCelsius()).isCloseTo(49.5, within(0.001));
        }

        @Test
        void aCoolerGpuDoesNotDisplaceTheCpuAsHighest() throws IOException {
            writeFile("/sys/class/thermal/thermal_zone0/temp", "62000");
            writeFile("/sys/class/thermal/thermal_zone1/temp", "51000");

            TemperatureInfo info = collector.getTemperatureInfo();

            assertThat(info.getHighestSensor()).isEqualTo("CPU");
            assertThat(info.getHighestTemperatureCelsius()).isEqualTo(62.0);
        }

        @Test
        void statusThresholdsAreNormalWarningHigh() throws IOException {
            writeFile("/sys/class/thermal/thermal_zone0/temp", "72000");

            assertThat(collector.getTemperatureInfo().getSensors())
                    .singleElement().satisfies(s -> assertThat(s.getStatus()).isEqualTo("Warning"));
        }

        @Test
        void throttleBitsAreDecodedIntoAVirtualSensor() throws IOException {
            writeFile("/sys/class/thermal/thermal_zone0/temp", "48000");
            // 0x50005: bit0 under-voltage now, bit2 throttling now, plus the "has occurred" bits.
            cannedCommands.put(VCGENCMD + " get_throttled", "throttled=0x50005");

            TemperatureInfo info = collector.getTemperatureInfo();

            assertThat(info.getSensors()).extracting(TemperatureSensor::getName)
                    .contains("Throttling Status");
            assertThat(info.getSensors()).filteredOn(s -> "Throttling Status".equals(s.getName()))
                    .singleElement()
                    .satisfies(s -> {
                        assertThat(s.getStatus()).isEqualTo("Throttling Active");
                        assertThat(s.getTemperatureCelsius()).isNull();
                    });
        }

        @Test
        void softTemperatureLimitOutranksThrottlingInTheReportedStatus() throws IOException {
            writeFile("/sys/class/thermal/thermal_zone0/temp", "48000");
            cannedCommands.put(VCGENCMD + " get_throttled", "throttled=0xd"); // bits 0, 2 and 3

            assertThat(collector.getTemperatureInfo().getSensors())
                    .filteredOn(s -> "Throttling Status".equals(s.getName()))
                    .singleElement()
                    .satisfies(s -> assertThat(s.getStatus()).isEqualTo("Temperature Limit Active"));
        }

        @Test
        void underVoltageAloneIsReportedAsUnderVoltage() throws IOException {
            writeFile("/sys/class/thermal/thermal_zone0/temp", "48000");
            cannedCommands.put(VCGENCMD + " get_throttled", "throttled=0x1");

            assertThat(collector.getTemperatureInfo().getSensors())
                    .filteredOn(s -> "Throttling Status".equals(s.getName()))
                    .singleElement()
                    .satisfies(s -> assertThat(s.getStatus()).isEqualTo("Under Voltage"));
        }

        @Test
        void aVirtualThrottleSensorIsExcludedFromTheTemperatureAverage() throws IOException {
            writeFile("/sys/class/thermal/thermal_zone0/temp", "40000");
            writeFile("/sys/class/thermal/thermal_zone1/temp", "60000");
            cannedCommands.put(VCGENCMD + " get_throttled", "throttled=0x0");

            TemperatureInfo info = collector.getTemperatureInfo();

            assertThat(info.getSensors()).hasSize(3);
            // Averaging over 3 sensors instead of the 2 with readings would give 33.3.
            assertThat(info.getAverageTemperatureCelsius()).isCloseTo(50.0, within(0.001));
        }

        @Test
        void anUnreadableThermalZoneYieldsNoSensorsRatherThanThrowing() {
            TemperatureInfo info = collector.getTemperatureInfo();

            assertThat(info.getSensors()).isEmpty();
            assertThat(info.getHighestTemperatureCelsius()).isNull();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // /boot/config.txt
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class ConfigTxt {

        private static final String OVERCLOCKED_CONFIG = """
                # Overclock
                arm_freq=2800
                core_freq=910
                sdram_freq=3200
                gpu_freq=800
                over_voltage=6
                force_turbo=1
                start_x=1
                gpu_mem=256
                """;

        @Test
        void overclockValuesAreParsedFromConfigTxt() throws IOException {
            writeFile("/boot/config.txt", OVERCLOCKED_CONFIG);

            OverclockInfo info = collector.getOverclockInfo();

            assertThat(info.getArmFrequency()).isEqualTo(2800);
            assertThat(info.getCoreFrequency()).isEqualTo(910);
            assertThat(info.getSdramFrequency()).isEqualTo(3200);
            assertThat(info.getGpuFrequency()).isEqualTo(800);
            assertThat(info.getOverVoltage()).isTrue();
            assertThat(info.getForceTurbo()).isTrue();
        }

        @Test
        void aStockConfigReportsNoOverVoltageAndNoForcedTurbo() throws IOException {
            writeFile("/boot/config.txt", "dtparam=audio=on\ndtoverlay=vc4-kms-v3d\n");

            OverclockInfo info = collector.getOverclockInfo();

            assertThat(info.getOverVoltage()).isFalse();
            assertThat(info.getForceTurbo()).isFalse();
            assertThat(info.getArmFrequency()).isNull();
        }

        @Test
        void overclockSettingsAreAlsoSurfacedRawInTheOsSpecificMap() throws IOException {
            writeFile("/boot/config.txt", OVERCLOCKED_CONFIG);

            @SuppressWarnings("unchecked")
            Map<String, Object> osSpecific = (Map<String, Object>) collector.getOsSpecificInfo();
            @SuppressWarnings("unchecked")
            Map<String, Object> overclock = (Map<String, Object>) osSpecific.get("overclockSettings");

            assertThat(overclock).containsEntry("arm_freq", "2800")
                    .containsEntry("over_voltage", "6")
                    .containsEntry("force_turbo", "1");
        }

        @Test
        void cameraIsEnabledOnlyWhenBothStartXAndEnoughGpuMemoryAreSet() throws IOException {
            writeFile("/boot/config.txt", OVERCLOCKED_CONFIG);

            assertThat(collector.getCameraInfo().getCameraEnabled()).isTrue();
        }

        @Test
        void insufficientGpuMemoryDisablesTheCameraEvenWithStartX() throws IOException {
            writeFile("/boot/config.txt", "start_x=1\ngpu_mem=64\n");

            assertThat(collector.getCameraInfo().getCameraEnabled()).isFalse();
        }

        @Test
        void aBoardSpecificGpuMemKeyDoesNotAbortCameraCollection() throws IOException {
            // Regression: gpu_mem_1024 satisfies a bare contains("gpu_mem") check but leaves
            // nothing to split on. The resulting exception used to escape to the method-level
            // catch, so detected/supported/model were never populated from vcgencmd below.
            writeFile("/boot/config.txt", "start_x=1\ngpu_mem_1024=128\n");
            cannedCommands.put(VCGENCMD + " get_camera", "supported=1 detected=1\nname=imx708");

            CameraInfo info = collector.getCameraInfo();

            assertThat(info.getCameraEnabled()).isFalse();
            assertThat(info.getCameraDetected()).isTrue();
            assertThat(info.getCameraSupported()).isTrue();
            assertThat(info.getCameraModel()).isEqualTo("imx708");
        }

        @Test
        void anUnparseableGpuMemValueAlsoLeavesTheRestOfTheCameraIntact() throws IOException {
            writeFile("/boot/config.txt", "start_x=1\ngpu_mem=\n");
            cannedCommands.put(VCGENCMD + " get_camera", "supported=1 detected=1");

            CameraInfo info = collector.getCameraInfo();

            assertThat(info.getCameraEnabled()).isFalse();
            assertThat(info.getCameraDetected()).isTrue();
        }

        @Test
        void anAbsentCameraIsReportedAsUndetected() throws IOException {
            writeFile("/boot/config.txt", "start_x=0\n");
            cannedCommands.put(VCGENCMD + " get_camera", "supported=0 detected=0");

            CameraInfo info = collector.getCameraInfo();

            assertThat(info.getCameraEnabled()).isFalse();
            assertThat(info.getCameraDetected()).isFalse();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Server info
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class ServerInfoFields {

        @Test
        void osReleaseKernelModelAndSerialAreAssembled() throws IOException {
            writeFile("/etc/os-release", """
                    PRETTY_NAME="Ubuntu 24.04.1 LTS"
                    NAME="Ubuntu"
                    VERSION_ID="24.04"
                    """);
            writeFile("/proc/version", "Linux version 6.8.0-1010-raspi (buildd@bos02-arm64) #11-Ubuntu SMP");
            writeModel("Raspberry Pi 5 Model B Rev 1.0");
            writeFile("/proc/device-tree/serial-number", "100000004f3a2a1b");
            cannedCommands.put("hostname", "dbworld-pi\n");

            ServerInfo info = collector.getServerInfo();

            assertThat(info.getOsName()).isEqualTo("Ubuntu 24.04.1 LTS");
            assertThat(info.getDistribution()).isEqualTo("Ubuntu");
            assertThat(info.getKernelVersion()).isEqualTo("6.8.0-1010-raspi");
            assertThat(info.getHostname()).isEqualTo("dbworld-pi");
            assertThat(info.getModel()).isEqualTo("Raspberry Pi 5 Model B Rev 1.0");
            assertThat(info.getSerialNumber()).isEqualTo("100000004f3a2a1b");
            assertThat(info.getManufacturer()).isEqualTo("Raspberry Pi Foundation");
        }

        @Test
        void uptimeIsRenderedInDaysHoursMinutes() throws IOException {
            writeFile("/proc/uptime", "349851.24 1315678.90");

            ServerInfo info = collector.getServerInfo();

            assertThat(info.getUptime()).isEqualTo("4 days 1 hours 10 minutes");
            assertThat(info.getBootTime()).isNotBlank();
        }

        @Test
        void subMinuteUptimeFallsBackToSeconds() throws IOException {
            writeFile("/proc/uptime", "42.00 84.00");

            assertThat(collector.getServerInfo().getUptime()).isEqualTo("42 seconds");
        }

        @Test
        void osNameDefaultsToRaspberryPiOsWhenPrettyNameIsAbsent() throws IOException {
            writeFile("/etc/os-release", "ID=raspbian\nVERSION_ID=\"12\"\n");

            ServerInfo info = collector.getServerInfo();

            assertThat(info.getOsName()).isEqualTo("Raspberry Pi OS");
            assertThat(info.getDistributionVersion()).isEqualTo("\"12\"");
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // HAT / GPIO / packages / tuning
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class Peripherals {

        @Test
        void hatEepromFieldsAreReadWhenAHatIsAttached() throws IOException {
            writeFile("/proc/device-tree/hat/vendor", "Raspberry Pi Ltd.");
            writeFile("/proc/device-tree/hat/product", "PoE+ HAT");
            writeFile("/proc/device-tree/hat/version", "1.0");
            writeFile("/proc/device-tree/hat/uuid", "8d1f0a1e-3f4b-4d2c-9a11-1c2b3d4e5f60");

            HatInfo hat = collector.getHatInfo();

            assertThat(hat.getHatPresent()).isTrue();
            assertThat(hat.getHatVendor()).isEqualTo("Raspberry Pi Ltd.");
            assertThat(hat.getHatProduct()).isEqualTo("PoE+ HAT");
            assertThat(hat.getHatVersion()).isEqualTo("1.0");
            assertThat(hat.getHatUuid()).isEqualTo("8d1f0a1e-3f4b-4d2c-9a11-1c2b3d4e5f60");
            // No device-tree binary parser exists, so mappings stay empty rather than invented.
            assertThat(hat.getGpioMappings()).isEmpty();
        }

        @Test
        void noHatNodeMeansNoHat() {
            HatInfo hat = collector.getHatInfo();

            assertThat(hat.getHatPresent()).isFalse();
            assertThat(hat.getHatVendor()).isNull();
        }

        @Test
        void gpioIsAccessibleWhenEitherSysfsOrTheCharDeviceExists() throws IOException {
            makeGpioAccessible();

            GpioInfo gpio = collector.getGpioInfo();

            assertThat(gpio.getGpioAccessible()).isTrue();
        }

        @Test
        void gpioIsInaccessibleAndReportsNoFabricatedPins() {
            GpioInfo gpio = collector.getGpioInfo();

            assertThat(gpio.getGpioAccessible()).isFalse();
            assertThat(gpio.getPins()).isEmpty();
            assertThat(gpio.getGpioLibrary()).isEqualTo("Unknown");
        }

        @Test
        void gpioLibraryIsDetectedFromWhichOutput() {
            cannedCommands.put("which", "/usr/bin/raspi-gpio");

            assertThat(collector.getGpioInfo().getGpioLibrary()).isEqualTo("raspi-gpio");
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // raspi-gpio get
    // ──────────────────────────────────────────────────────────────────────────

    @Nested
    class GpioPins {

        /** Verbatim shape of `raspi-gpio get`, bank headers included. */
        private static final String RASPI_GPIO_GET = """
                BANK0 (GPIO 0 to 27):
                GPIO 0: level=1 fsel=0 func=INPUT
                GPIO 2: level=1 fsel=4 alt=0 func=SDA1
                GPIO 14: level=1 fsel=4 alt=0 func=TXD1 pull=NONE
                GPIO 18: level=0 fsel=1 func=OUTPUT pull=DOWN
                BANK1 (GPIO 28 to 45):
                GPIO 28: level=1 fsel=2 alt=5 func=RGMII_MDIO pull=UP
                """;

        @Test
        void realRaspiGpioOutputIsParsedInsteadOfYieldingNothing() throws IOException {
            // Regression: the pin token is "0:" (colon attached), so the old positional parser
            // threw on the very first pin line and its method-wide catch discarded every
            // remaining line — getGpioInfo() always returned an empty list on real hardware.
            makeGpioAccessible();
            cannedCommands.put("raspi-gpio get", RASPI_GPIO_GET);

            List<GpioPin> pins = collector.getGpioInfo().getPins();

            assertThat(pins).extracting(GpioPin::getPin).containsExactly(0, 2, 14, 18, 28);
        }

        @Test
        void bankHeaderLinesAreNotMistakenForPins() throws IOException {
            makeGpioAccessible();
            cannedCommands.put("raspi-gpio get", RASPI_GPIO_GET);

            // "BANK0 (GPIO 0 to 27):" contains "GPIO" and would have matched a contains() check.
            assertThat(collector.getGpioInfo().getPins()).hasSize(5);
        }

        @Test
        void aPlainInputPinCarriesItsLevelAndFunction() throws IOException {
            makeGpioAccessible();
            cannedCommands.put("raspi-gpio get", RASPI_GPIO_GET);

            assertThat(pinNumbered(0)).satisfies(p -> {
                assertThat(p.getName()).isEqualTo("GPIO0");
                assertThat(p.getBcmPin()).isEqualTo("0");
                assertThat(p.getValue()).isEqualTo("1");
                assertThat(p.getFunction()).isEqualTo("INPUT");
                assertThat(p.getMode()).isEqualTo("INPUT");
            });
        }

        @Test
        void anAltFunctionPinReportsTheMuxIndexAsItsMode() throws IOException {
            makeGpioAccessible();
            cannedCommands.put("raspi-gpio get", RASPI_GPIO_GET);

            assertThat(pinNumbered(2)).satisfies(p -> {
                assertThat(p.getFunction()).isEqualTo("SDA1");
                assertThat(p.getMode()).isEqualTo("ALT0");
            });
            assertThat(pinNumbered(28)).satisfies(p -> {
                assertThat(p.getFunction()).isEqualTo("RGMII_MDIO");
                assertThat(p.getMode()).isEqualTo("ALT5");
            });
        }

        @Test
        void pullDirectionIsDecodedWhenReported() throws IOException {
            makeGpioAccessible();
            cannedCommands.put("raspi-gpio get", RASPI_GPIO_GET);

            assertThat(pinNumbered(28)).satisfies(p -> {
                assertThat(p.getPullUp()).isTrue();
                assertThat(p.getPullDown()).isFalse();
            });
            assertThat(pinNumbered(18)).satisfies(p -> {
                assertThat(p.getPullUp()).isFalse();
                assertThat(p.getPullDown()).isTrue();
            });
            assertThat(pinNumbered(14)).satisfies(p -> {
                assertThat(p.getPullUp()).isFalse();
                assertThat(p.getPullDown()).isFalse();
            });
        }

        @Test
        void anUnreportedPullStaysNullRatherThanBecomingFalse() throws IOException {
            makeGpioAccessible();
            cannedCommands.put("raspi-gpio get", RASPI_GPIO_GET);

            // GPIO 0 has no pull= column at all — "not reported" must stay distinguishable
            // from the pull=NONE that GPIO 14 reports.
            assertThat(pinNumbered(0).getPullUp()).isNull();
            assertThat(pinNumbered(0).getPullDown()).isNull();
        }

        @Test
        void fieldsAreReadByKeySoColumnOrderDoesNotMatter() throws IOException {
            makeGpioAccessible();
            cannedCommands.put("raspi-gpio get", "GPIO 7: func=SPI0_CE1_N alt=0 fsel=4 level=0\n");

            assertThat(pinNumbered(7)).satisfies(p -> {
                assertThat(p.getValue()).isEqualTo("0");
                assertThat(p.getFunction()).isEqualTo("SPI0_CE1_N");
                assertThat(p.getMode()).isEqualTo("ALT0");
            });
        }

        @Test
        void oneMalformedLineDoesNotDiscardThePinsAroundIt() throws IOException {
            makeGpioAccessible();
            cannedCommands.put("raspi-gpio get", """
                    GPIO 0: level=1 fsel=0 func=INPUT
                    GPIO x: this line is not parseable
                    GPIO 2: level=0 fsel=1 func=OUTPUT
                    """);

            assertThat(collector.getGpioInfo().getPins())
                    .extracting(GpioPin::getPin).containsExactly(0, 2);
        }

        @Test
        void raspiGpioIsNotConsultedWhenGpioIsInaccessible() {
            cannedCommands.put("raspi-gpio get", RASPI_GPIO_GET);

            // No /dev/gpiochip0 and no /sys/class/gpio, so the command must not be trusted.
            assertThat(collector.getGpioInfo().getPins()).isEmpty();
        }

        @Test
        void emptyRaspiGpioOutputYieldsNoPins() throws IOException {
            makeGpioAccessible();

            assertThat(collector.getGpioInfo().getPins()).isEmpty();
        }

        private GpioPin pinNumbered(int number) {
            return collector.getGpioInfo().getPins().stream()
                    .filter(p -> p.getPin() == number)
                    .findFirst()
                    .orElseThrow(() -> new AssertionError("GPIO " + number + " was not parsed"));
        }

        @Test
        void pipeDelimitedDpkgOutputIsParsedAndSortedByName() {
            cannedCommands.put("dpkg-query", """
                    nginx|1.24.0-2ubuntu7|arm64|2048|small, powerful, scalable web/proxy server
                    curl|8.5.0-2ubuntu10|arm64|512|command line tool for transferring data
                    """);

            List<PackageInfo> packages = collector.getInstalledPackages();

            assertThat(packages).extracting(PackageInfo::getName).containsExactly("curl", "nginx");
            assertThat(packages.get(0).getSize()).isEqualTo(512L);
            assertThat(packages.get(0).getArchitecture()).isEqualTo("arm64");
            assertThat(packages.get(1).getDescription()).isEqualTo("small, powerful, scalable web/proxy server");
        }

        @Test
        void malformedPackageLinesAreSkippedWithoutLosingTheGoodOnes() {
            cannedCommands.put("dpkg-query", """
                    nginx|1.24.0|arm64|2048|web server
                    truncated|line
                    curl|8.5.0|arm64|512|transfer tool
                    """);

            assertThat(collector.getInstalledPackages()).extracting(PackageInfo::getName)
                    .containsExactly("curl", "nginx");
        }

        @Test
        void cpuFrequencyScalingIsReadFromSysfs() throws IOException {
            writeFile("/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor", "ondemand\n");
            writeFile("/sys/devices/system/cpu/cpu0/cpufreq/scaling_min_freq", "1500000\n");
            writeFile("/sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq", "2400000\n");
            writeFile("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq", "1800000\n");

            @SuppressWarnings("unchecked")
            Map<String, Object> osSpecific = (Map<String, Object>) collector.getOsSpecificInfo();
            @SuppressWarnings("unchecked")
            Map<String, Object> tuning = (Map<String, Object>) osSpecific.get("performanceTuning");

            assertThat(tuning).containsEntry("cpuGovernor", "ondemand")
                    .containsEntry("minFrequency", "1500000")
                    .containsEntry("maxFrequency", "2400000")
                    .containsEntry("currentFrequency", "1800000");
        }

        @Test
        void dsiDisplayIsDetectedFromTheDeviceTreeNode() throws IOException {
            writeFile("/proc/device-tree/display/status", "okay");

            assertThat(collector.getDisplayInfo().getDisplayType()).isEqualTo("DSI");
        }

        @Test
        void hdmiIsTheDefaultDisplayTypeWithoutADsiNode() {
            assertThat(collector.getDisplayInfo().getDisplayType()).isEqualTo("HDMI");
        }
    }
}
