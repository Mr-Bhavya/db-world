//package com.db.dbworld.services.server;
//
//import com.db.dbworld.helpers.ProcessExecutor;
//import com.db.dbworld.payloads.server.*;
//import com.db.dbworld.payloads.server.os.raspberrypi.*;
//import lombok.extern.log4j.Log4j2;
//import org.springframework.stereotype.Service;
//
//import java.nio.file.Files;
//import java.nio.file.Path;
//import java.time.Instant;
//import java.util.*;
//import java.util.regex.Pattern;
//import java.util.stream.Collectors;
//
///**
// * Raspberry Pi specific server information collector.
// * Collects detailed information about Raspberry Pi hardware and configuration.
// */
///**
// * @deprecated Migrated to com.db.dbworld.app.system.info.collector.linux.RaspberryPiServerInfoCollector.
// */
//@Deprecated(forRemoval = true)
//@Log4j2
//// @Service("raspberryPiServerInfoCollector")
//public class RaspberryPiServerInfoCollector extends ServerInfoCollector {
//
//    // Common paths for Raspberry Pi
//    private static final Path CPU_INFO_PATH = Path.of("/proc/cpuinfo");
//    private static final Path MEM_INFO_PATH = Path.of("/proc/meminfo");
//    private static final Path DEVICE_TREE_MODEL_PATH = Path.of("/proc/device-tree/model");
//    private static final Path DEVICE_TREE_SERIAL_PATH = Path.of("/proc/device-tree/serial-number");
//    private static final Path VERSION_PATH = Path.of("/proc/version");
//    private static final Path CPU_TEMP_PATH = Path.of("/sys/class/thermal/thermal_zone0/temp");
//    private static final Path GPU_TEMP_PATH = Path.of("/sys/class/thermal/thermal_zone1/temp");
//    private static final Path VC_GENCMD_PATH = Path.of("/usr/bin/vcgencmd");
//    private static final Path CONFIG_TXT_PATH = Path.of("/boot/config.txt");
//    private static final Path OTP_DUMP_PATH = Path.of("/sys/firmware/devicetree/base/soc/ranges");
//
//    // Common commands for Raspberry Pi
//    private static final String[] GET_THROTTLED_STATUS = {VC_GENCMD_PATH.toString(), "get_throttled"};
//    private static final String[] GET_VOLTAGES = {VC_GENCMD_PATH.toString(), "measure_volts"};
//    private static final String[] GET_CLOCK_SPEEDS = {VC_GENCMD_PATH.toString(), "measure_clock", "arm"};
//    private static final String[] GET_MEMORY_SPLIT = {VC_GENCMD_PATH.toString(), "get_mem", "arm"};
//    private static final String[] GET_CONFIG = {VC_GENCMD_PATH.toString(), "get_config", "int"};
//    private static final String[] GET_CAMERA_STATUS = {VC_GENCMD_PATH.toString(), "get_camera"};
//    private static final String[] GET_DISPLAY_STATUS = {VC_GENCMD_PATH.toString(), "get_display_power"};
//    private static final String[] GET_GPIO_STATUS = {VC_GENCMD_PATH.toString(), "get_gpio"};
//
//    public RaspberryPiServerInfoCollector(ProcessExecutor processExecutor) {
//        super(processExecutor);
//        log.info("RaspberryPiServerInfoCollector initialized");
//    }
//
//    @Override
//    public BaseServerInfo collect() {
//        log.info("Starting Raspberry Pi system information collection");
//
//        BaseServerInfo baseInfo = createServerInfo();
//
//        try {
//            // Collect common system information
//            baseInfo.setServerInfo(getServerInfo());
//            baseInfo.setBiosInfo(getBiosInfo());
//            baseInfo.setCpu(getCpuInfo());
//            baseInfo.setMemory(getMemoryInfo());
//            baseInfo.setDisk(getDiskInfo());
//            baseInfo.setNetwork(getNetworkInfo());
//            baseInfo.setProcesses(getRunningProcesses());
//            baseInfo.setServices(getRunningServices());
//            baseInfo.setPerformance(getPerformanceMetrics());
//            baseInfo.setTemperature(getTemperatureInfo());
//
//            // Create Raspberry Pi specific information
//            RaspberryPiServerInfo rpiInfo = new RaspberryPiServerInfo();
//            rpiInfo.setRaspberryPiInfo(getRaspberryPiInfo());
//            rpiInfo.setGpioInfo(getGpioInfo());
//            rpiInfo.setCameraInfo(getCameraInfo());
//            rpiInfo.setHatInfo(getHatInfo());
//            rpiInfo.setInstalledPackages(getInstalledPackages());
//            rpiInfo.setOverclockInfo(getOverclockInfo());
//            rpiInfo.setDisplayInfo(getDisplayInfo());
//
//            // Cast to RaspberryPiServerInfo
//            if (baseInfo instanceof RaspberryPiServerInfo rpiBaseInfo) {
//                rpiBaseInfo.setRaspberryPiInfo(rpiInfo.getRaspberryPiInfo());
//                rpiBaseInfo.setGpioInfo(rpiInfo.getGpioInfo());
//                rpiBaseInfo.setCameraInfo(rpiInfo.getCameraInfo());
//                rpiBaseInfo.setHatInfo(rpiInfo.getHatInfo());
//                rpiBaseInfo.setInstalledPackages(rpiInfo.getInstalledPackages());
//                rpiBaseInfo.setOverclockInfo(rpiInfo.getOverclockInfo());
//                rpiBaseInfo.setDisplayInfo(rpiInfo.getDisplayInfo());
//
//                // Calculate health status
//                rpiBaseInfo.setHealthStatus(calculateHealthStatus(rpiBaseInfo));
//
//                return rpiBaseInfo;
//            }
//
//            log.error("Failed to cast to RaspberryPiServerInfo");
//            baseInfo.setError("Failed to collect Raspberry Pi specific information");
//            return baseInfo;
//
//        } catch (Exception e) {
//            log.error("Error collecting Raspberry Pi information", e);
//            baseInfo.setError("Error collecting information: " + e.getMessage());
//            return baseInfo;
//        }
//    }
//
//    /**
//     * Get detailed Raspberry Pi information.
//     */
//    public RaspberryPiInfo getRaspberryPiInfo() {
//        log.debug("Collecting Raspberry Pi information");
//
//        RaspberryPiInfo info = RaspberryPiInfo.builder()
//                .isRaspberryPi(true)
//                .build();
//
//        try {
//            // Read model from device tree
//            String model = readFileSafe(DEVICE_TREE_MODEL_PATH);
//            if (!model.isEmpty()) {
//                info.setModel(model.trim());
//
//                // Parse model for details
//                if (model.contains("Pi 5")) {
//                    info.setSoc("BCM2712");
//                    info.setProcessor("Cortex-A76");
//                } else if (model.contains("Pi 4")) {
//                    info.setSoc("BCM2711");
//                    info.setProcessor("Cortex-A72");
//                } else if (model.contains("Pi 3")) {
//                    if (model.contains("Model B+")) {
//                        info.setSoc("BCM2837B0");
//                    } else {
//                        info.setSoc("BCM2837");
//                    }
//                    info.setProcessor("Cortex-A53");
//                } else if (model.contains("Pi 2")) {
//                    info.setSoc("BCM2836");
//                    info.setProcessor("Cortex-A7");
//                } else if (model.contains("Pi Zero")) {
//                    info.setSoc("BCM2835");
//                    info.setProcessor("ARM1176JZF-S");
//                } else if (model.contains("Pi 1") || model.contains("Model A") || model.contains("Model B")) {
//                    info.setSoc("BCM2835");
//                    info.setProcessor("ARM1176JZF-S");
//                }
//            }
//
//            // Read serial number
//            String serial = readFileSafe(DEVICE_TREE_SERIAL_PATH);
//            if (!serial.isEmpty()) {
//                info.setSerial(serial.trim());
//            }
//
//            // Get revision from cpuinfo
//            String cpuInfo = readFileSafe(CPU_INFO_PATH);
//            String revision = extractFromCpuInfo(cpuInfo, "Revision");
//            if (revision != null) {
//                info.setRevision(revision);
//
//                // Parse revision code for more details
//                try {
//                    // Revision codes from Raspberry Pi documentation
//                    Map<String, String> revisionCodes = Map.of(
//                            "a02082", "Pi 3 Model B",
//                            "a020d3", "Pi 3 Model B+",
//                            "a03111", "Pi 4 1GB",
//                            "b03111", "Pi 4 2GB",
//                            "c03111", "Pi 4 4GB",
//                            "d03114", "Pi 4 8GB",
//                            "902120", "Pi Zero 2 W",
//                            "c03130", "Pi 400"
//                    );
//
//                    if (revisionCodes.containsKey(revision.toLowerCase())) {
//                        info.setModel(revisionCodes.get(revision.toLowerCase()));
//                    }
//                } catch (Exception e) {
//                    log.debug("Error parsing revision code", e);
//                }
//            }
//
//            // Get hardware from cpuinfo
//            String hardware = extractFromCpuInfo(cpuInfo, "Hardware");
//            if (hardware != null) {
//                info.setHardware(hardware);
//            }
//
//            // Get firmware version using vcgencmd
//            String firmwareVersion = exec(VC_GENCMD_PATH.toString(), "version");
//            if (!firmwareVersion.isEmpty()) {
//                info.setFirmwareVersion(firmwareVersion.trim());
//            }
//
//            // Get memory from meminfo
//            String memInfo = readFileSafe(MEM_INFO_PATH);
//            if (!memInfo.isEmpty()) {
//                String totalMem = extractFromMemInfo(memInfo, "MemTotal");
//                if (totalMem != null) {
//                    try {
//                        // Convert from KB to MB
//                        long memKB = Long.parseLong(totalMem.replaceAll("[^0-9]", ""));
//                        info.setMemoryMB((int) (memKB / 1024));
//                    } catch (NumberFormatException e) {
//                        log.debug("Error parsing memory value", e);
//                    }
//                }
//            }
//
//            // Get manufacturer and warranty info from revision
//            info.setMaker("Raspberry Pi Foundation");
//
//            // Check warranty status using vcgencmd
//            String otpDump = readFileSafe(OTP_DUMP_PATH);
//            if (!otpDump.isEmpty()) {
//                // Check specific bits for warranty
//                info.setWarrantyVoid("Unknown");
//            }
//
//            // Get board version
//            String boardVersion = extractFromCpuInfo(cpuInfo, "Revision");
//            if (boardVersion != null) {
//                try {
//                    // Convert hex revision to board version
//                    int rev = Integer.parseInt(boardVersion, 16);
//                    info.setBoardVersion(rev & 0x0F); // Last 4 bits often contain board version
//                } catch (NumberFormatException e) {
//                    log.debug("Error parsing board version", e);
//                }
//            }
//
//            log.debug("Raspberry Pi information collected successfully");
//
//        } catch (Exception e) {
//            log.warn("Error collecting Raspberry Pi information", e);
//        }
//
//        return info;
//    }
//
//    /**
//     * Get GPIO information.
//     */
//    public GpioInfo getGpioInfo() {
//        log.debug("Collecting GPIO information");
//
//        GpioInfo gpioInfo = GpioInfo.builder()
//                .gpioAccessible(false)
//                .build();
//
//        try {
//            List<GpioPin> pins = new ArrayList<>();
//
//            // Check if GPIO is accessible
//            boolean gpioAccessible = Files.exists(Path.of("/sys/class/gpio")) ||
//                    Files.exists(Path.of("/dev/gpiochip0"));
//
//            gpioInfo.setGpioAccessible(gpioAccessible);
//
//            // Get GPIO library info
//            String gpioLibrary = "Unknown";
//            try {
//                // Try to detect installed GPIO libraries
//                if (exec("which", "raspi-gpio").contains("/raspi-gpio")) {
//                    gpioLibrary = "raspi-gpio";
//                } else if (exec("which", "gpio").contains("/gpio")) {
//                    gpioLibrary = "WiringPi";
//                } else if (exec("python3", "-c", "import RPi.GPIO; print('RPi.GPIO')").contains("RPi.GPIO")) {
//                    gpioLibrary = "RPi.GPIO (Python)";
//                } else if (exec("python3", "-c", "import gpiozero; print('gpiozero')").contains("gpiozero")) {
//                    gpioLibrary = "gpiozero (Python)";
//                }
//            } catch (Exception e) {
//                log.debug("Error detecting GPIO library", e);
//            }
//            gpioInfo.setGpioLibrary(gpioLibrary);
//
//            // Get pin states using raspi-gpio if available
//            if (gpioAccessible) {
//                try {
//                    String gpioOutput = exec("raspi-gpio", "get");
//                    if (!gpioOutput.isEmpty()) {
//                        pins.addAll(parseGpioOutput(gpioOutput));
//                    }
//                } catch (Exception e) {
//                    log.debug("Error getting GPIO states", e);
//                }
//            }
//
//            // If no pins were collected, create a default list
//            if (pins.isEmpty()) {
//                pins = createDefaultGpioPins();
//            }
//
//            gpioInfo.setPins(pins);
//            log.debug("GPIO information collected successfully");
//
//        } catch (Exception e) {
//            log.warn("Error collecting GPIO information", e);
//        }
//
//        return gpioInfo;
//    }
//
//    /**
//     * Get camera information.
//     */
//    public CameraInfo getCameraInfo() {
//        log.debug("Collecting camera information");
//
//        CameraInfo cameraInfo = CameraInfo.builder()
//                .cameraEnabled(false)
//                .cameraDetected(false)
//                .build();
//
//        try {
//            // Check if camera is enabled in config
//            if (Files.exists(CONFIG_TXT_PATH)) {
//                String config = readFileSafe(CONFIG_TXT_PATH);
//                boolean startCameraEnabled = config.contains("start_x=1");
//                boolean gpuMemoryAllocated = config.contains("gpu_mem") &&
//                        Integer.parseInt(config.split("gpu_mem=")[1].split("\n")[0].trim()) >= 128;
//
//                cameraInfo.setCameraEnabled(startCameraEnabled && gpuMemoryAllocated);
//            }
//
//            // Check if camera is detected
//            String cameraStatus = exec(GET_CAMERA_STATUS);
//            if (!cameraStatus.isEmpty()) {
//                if (cameraStatus.contains("supported=1") || cameraStatus.contains("detected=1")) {
//                    cameraInfo.setCameraDetected(true);
//                    cameraInfo.setCameraSupported(true);
//                }
//
//                // Extract camera model if available
//                if (cameraStatus.contains("name=")) {
//                    String name = cameraStatus.split("name=")[1].split("\n")[0].trim();
//                    cameraInfo.setCameraModel(name);
//                }
//            }
//
//            // Check camera firmware/driver
//            try {
//                String vcgencmdOutput = exec(VC_GENCMD_PATH.toString(), "get_camera");
//                if (vcgencmdOutput.contains("supported")) {
//                    cameraInfo.setCameraDriver("vcgencmd");
//                    cameraInfo.setCameraFirmware(getStringValue(exec(VC_GENCMD_PATH.toString(), "version"), "Unknown"));
//                }
//            } catch (Exception e) {
//                log.debug("Error checking camera firmware", e);
//            }
//
//            // Check camera resolution if camera is active
//            if (cameraInfo.getCameraDetected()) {
//                try {
//                    // Try to get camera resolution using v4l2-ctl
//                    String resolution = exec("v4l2-ctl", "--list-formats-ext");
//                    if (!resolution.isEmpty()) {
//                        // Parse resolution from output
//                        Pattern pattern = Pattern.compile("\\d{3,4}x\\d{3,4}");
//                        java.util.regex.Matcher matcher = pattern.matcher(resolution);
//                        if (matcher.find()) {
//                            cameraInfo.setCameraResolution(matcher.group());
//                        }
//                    }
//                } catch (Exception e) {
//                    log.debug("Error getting camera resolution", e);
//                }
//            }
//
//            log.debug("Camera information collected successfully");
//
//        } catch (Exception e) {
//            log.warn("Error collecting camera information", e);
//        }
//
//        return cameraInfo;
//    }
//
//    /**
//     * Get HAT (Hardware Attached on Top) information.
//     */
//    public HatInfo getHatInfo() {
//        log.debug("Collecting HAT information");
//
//        HatInfo hatInfo = HatInfo.builder()
//                .hatPresent(false)
//                .build();
//
//        try {
//            // Check for HAT EEPROM
//            Path hatEepromPath = Path.of("/proc/device-tree/hat");
//            if (Files.exists(hatEepromPath)) {
//                hatInfo.setHatPresent(true);
//
//                // Read HAT vendor
//                Path vendorPath = Path.of("/proc/device-tree/hat/vendor");
//                if (Files.exists(vendorPath)) {
//                    String vendor = readFileSafe(vendorPath);
//                    hatInfo.setHatVendor(vendor.trim());
//                }
//
//                // Read HAT product
//                Path productPath = Path.of("/proc/device-tree/hat/product");
//                if (Files.exists(productPath)) {
//                    String product = readFileSafe(productPath);
//                    hatInfo.setHatProduct(product.trim());
//                }
//
//                // Read HAT version
//                Path versionPath = Path.of("/proc/device-tree/hat/version");
//                if (Files.exists(versionPath)) {
//                    String version = readFileSafe(versionPath);
//                    hatInfo.setHatVersion(version.trim());
//                }
//
//                // Read HAT UUID
//                Path uuidPath = Path.of("/proc/device-tree/hat/uuid");
//                if (Files.exists(uuidPath)) {
//                    String uuid = readFileSafe(uuidPath);
//                    hatInfo.setHatUuid(uuid.trim());
//                }
//
//                // Parse GPIO mappings
//                List<HatGpioMapping> mappings = new ArrayList<>();
//                Path gpioMappingsPath = Path.of("/proc/device-tree/hat/gpio-map");
//                if (Files.exists(gpioMappingsPath)) {
//                    mappings.addAll(parseHatGpioMappings());
//                }
//                hatInfo.setGpioMappings(mappings);
//            }
//
//            log.debug("HAT information collected successfully");
//
//        } catch (Exception e) {
//            log.warn("Error collecting HAT information", e);
//        }
//
//        return hatInfo;
//    }
//
//    /**
//     * Get installed packages information.
//     */
//    public List<PackageInfo> getInstalledPackages() {
//        log.debug("Collecting installed packages information");
//
//        List<PackageInfo> packages = new ArrayList<>();
//
//        try {
//            // Get dpkg installed packages
//            String dpkgOutput = exec("dpkg-query", "-W", "-f=${Package}|${Version}|${Architecture}|${Installed-Size}|${Description}\\n");
//
//            if (!dpkgOutput.isEmpty()) {
//                String[] lines = dpkgOutput.split("\n");
//                for (String line : lines) {
//                    try {
//                        String[] parts = line.split("\\|", 5);
//                        if (parts.length >= 4) {
//                            PackageInfo pkg = PackageInfo.builder()
//                                    .name(parts[0])
//                                    .version(parts[1])
//                                    .architecture(parts[2])
//                                    .size(!parts[3].isEmpty() ? Long.parseLong(parts[3]) : 0)
//                                    .description(parts.length > 4 ? parts[4] : "")
//                                    .repository("apt")
//                                    .maintainer("")
//                                    .installDate(System.currentTimeMillis()) // Default
//                                    .section("")
//                                    .build();
//                            packages.add(pkg);
//                        }
//                    } catch (Exception e) {
//                        log.debug("Error parsing package line: {}", line, e);
//                    }
//                }
//            }
//
//            // Sort by name
//            packages.sort(Comparator.comparing(PackageInfo::getName));
//
//            log.debug("Collected {} installed packages", packages.size());
//
//        } catch (Exception e) {
//            log.warn("Error collecting installed packages", e);
//        }
//
//        return packages;
//    }
//
//    /**
//     * Get overclocking information.
//     */
//    public OverclockInfo getOverclockInfo() {
//        log.debug("Collecting overclocking information");
//
//        OverclockInfo overclockInfo = OverclockInfo.builder()
//                .overVoltage(false)
//                .turboEnabled(true) // Most Pis have turbo enabled by default
//                .build();
//
//        try {
//            // Check config.txt for overclock settings
//            if (Files.exists(CONFIG_TXT_PATH)) {
//                String config = readFileSafe(CONFIG_TXT_PATH);
//
//                // Parse over_voltage setting
//                if (config.contains("over_voltage=")) {
//                    String ovValue = config.split("over_voltage=")[1].split("\n")[0].trim();
//                    try {
//                        int ov = Integer.parseInt(ovValue);
//                        overclockInfo.setOverVoltage(ov > 0);
//                        overclockInfo.setOverVoltageMin(ov);
//                        overclockInfo.setOverVoltageMax(ov);
//                    } catch (NumberFormatException e) {
//                        log.debug("Error parsing over_voltage value", e);
//                    }
//                }
//
//                // Parse arm_freq
//                if (config.contains("arm_freq=")) {
//                    String armFreq = config.split("arm_freq=")[1].split("\n")[0].trim();
//                    try {
//                        overclockInfo.setArmFrequency(Integer.parseInt(armFreq));
//                    } catch (NumberFormatException e) {
//                        log.debug("Error parsing arm_freq value", e);
//                    }
//                }
//
//                // Parse core_freq
//                if (config.contains("core_freq=")) {
//                    String coreFreq = config.split("core_freq=")[1].split("\n")[0].trim();
//                    try {
//                        overclockInfo.setCoreFrequency(Integer.parseInt(coreFreq));
//                    } catch (NumberFormatException e) {
//                        log.debug("Error parsing core_freq value", e);
//                    }
//                }
//
//                // Parse sdram_freq
//                if (config.contains("sdram_freq=")) {
//                    String sdramFreq = config.split("sdram_freq=")[1].split("\n")[0].trim();
//                    try {
//                        overclockInfo.setSdramFrequency(Integer.parseInt(sdramFreq));
//                    } catch (NumberFormatException e) {
//                        log.debug("Error parsing sdram_freq value", e);
//                    }
//                }
//
//                // Parse gpu_freq
//                if (config.contains("gpu_freq=")) {
//                    String gpuFreq = config.split("gpu_freq=")[1].split("\n")[0].trim();
//                    try {
//                        overclockInfo.setGpuFrequency(Integer.parseInt(gpuFreq));
//                    } catch (NumberFormatException e) {
//                        log.debug("Error parsing gpu_freq value", e);
//                    }
//                }
//
//                // Check for force_turbo
//                overclockInfo.setForceTurbo(config.contains("force_turbo=1"));
//
//                // Check for overclock preset
//                if (config.contains("overclock_preset=")) {
//                    String preset = config.split("overclock_preset=")[1].split("\n")[0].trim();
//                    overclockInfo.setOverclockPreset(preset);
//                }
//            }
//
//            // Get current clock speeds using vcgencmd
//            try {
//                String armClock = exec(VC_GENCMD_PATH.toString(), "measure_clock", "arm");
//                if (armClock.contains("=")) {
//                    String freq = armClock.split("=")[1].trim();
//                    try {
//                        long freqHz = Long.parseLong(freq);
//                        overclockInfo.setArmFrequency((int) (freqHz / 1000000)); // Convert to MHz
//                    } catch (NumberFormatException e) {
//                        log.debug("Error parsing arm clock frequency", e);
//                    }
//                }
//            } catch (Exception e) {
//                log.debug("Error getting current clock speeds", e);
//            }
//
//            log.debug("Overclocking information collected successfully");
//
//        } catch (Exception e) {
//            log.warn("Error collecting overclocking information", e);
//        }
//
//        return overclockInfo;
//    }
//
//    /**
//     * Get display information.
//     */
//    public DisplayInfo getDisplayInfo() {
//        log.debug("Collecting display information");
//
//        DisplayInfo displayInfo = DisplayInfo.builder()
//                .displayConnected(false)
//                .build();
//
//        try {
//            // Check display power status
//            String displayPower = exec(GET_DISPLAY_STATUS);
//            if (!displayPower.isEmpty()) {
//                displayInfo.setDisplayConnected(displayPower.contains("=1") || displayPower.contains("on"));
//            }
//
//            // Get current display mode
//            String hdmiMode = exec(VC_GENCMD_PATH.toString(), "get_config", "hdmi_mode");
//            if (hdmiMode.contains("=")) {
//                displayInfo.setDisplayHdmiMode(hdmiMode.split("=")[1].trim());
//            }
//
//            // Check for composite video
//            String compositeEnabled = exec(VC_GENCMD_PATH.toString(), "get_config", "enable_tvout");
//            if (!compositeEnabled.isEmpty()) {
//                displayInfo.setDisplayCompositeEnabled(compositeEnabled.contains("=1"));
//            }
//
//            // Get current resolution from system
//            try {
//                String xrandrOutput = exec("xrandr");
//                if (!xrandrOutput.isEmpty()) {
//                    // Parse current resolution (line containing "*")
//                    for (String line : xrandrOutput.split("\n")) {
//                        if (line.contains("*")) {
//                            String[] parts = line.trim().split("\\s+");
//                            if (parts.length >= 1) {
//                                displayInfo.setDisplayResolution(parts[0]);
//                                break;
//                            }
//                        }
//                    }
//                }
//            } catch (Exception e) {
//                log.debug("Error getting display resolution from xrandr", e);
//            }
//
//            // Get overscan settings
//            String overscan = exec(VC_GENCMD_PATH.toString(), "get_config", "overscan");
//            if (!overscan.isEmpty()) {
//                displayInfo.setDisplayOverscan(overscan);
//            }
//
//            // Check for hdmi_safe mode
//            String hdmiSafe = exec(VC_GENCMD_PATH.toString(), "get_config", "hdmi_safe");
//            if (!hdmiSafe.isEmpty()) {
//                displayInfo.setDisplayHdmiSafe(hdmiSafe.contains("=1"));
//            }
//
//            // Determine display type (HDMI, DSI, Composite)
//            displayInfo.setDisplayType("HDMI"); // Default assumption
//
//            // Check for DSI display (Raspberry Pi official display)
//            if (Files.exists(Path.of("/proc/device-tree/display"))) {
//                displayInfo.setDisplayType("DSI");
//            }
//
//            log.debug("Display information collected successfully");
//
//        } catch (Exception e) {
//            log.warn("Error collecting display information", e);
//        }
//
//        return displayInfo;
//    }
//
//    /* ============================================
//       IMPLEMENTATION OF ABSTRACT METHODS FROM BASE CLASS
//       ============================================ */
//
//    @Override
//    public CpuInfo getCpuInfo() {
//        log.debug("Collecting CPU information for Raspberry Pi");
//
//        CpuInfo cpuInfo = CpuInfo.builder().build();
//
//        try {
//            String cpuInfoStr = readFileSafe(CPU_INFO_PATH);
//            if (!cpuInfoStr.isEmpty()) {
//                Map<String, String> cpuMap = parseKeyValueOutput(cpuInfoStr, ":");
//
//                cpuInfo.setName(getStringValue(cpuMap.get("model name"), "ARM Processor"));
//                cpuInfo.setVendor(getStringValue(cpuMap.get("Hardware"), "Broadcom"));
//                cpuInfo.setArchitecture(getStringValue(cpuMap.get("CPU architecture"), "arm"));
//
//                // Parse processor count
//                String processorCount = cpuMap.get("processor");
//                if (processorCount != null) {
//                    try {
//                        int count = Integer.parseInt(processorCount) + 1; // processor numbers start at 0
//                        cpuInfo.setNoOfCores(count);
//                        cpuInfo.setThreads(count);
//                        cpuInfo.setAvailableProcessors(count);
//                    } catch (NumberFormatException e) {
//                        log.debug("Error parsing processor count", e);
//                    }
//                }
//
//                // Get BogoMIPS for frequency estimation
//                String bogoMips = cpuMap.get("BogoMIPS");
//                if (bogoMips != null) {
//                    try {
//                        double bogo = Double.parseDouble(bogoMips);
//                        // Rough estimation: BogoMIPS * 0.6 ≈ MHz
//                        long estimatedFreq = (long) (bogo * 0.6 * 1000000);
//                        cpuInfo.setCurrentFrequency(estimatedFreq);
//                        cpuInfo.setMaxFrequency(estimatedFreq);
//                    } catch (NumberFormatException e) {
//                        log.debug("Error parsing BogoMIPS", e);
//                    }
//                }
//
//                // Get actual frequency from vcgencmd if available
//                try {
//                    String freqOutput = exec(VC_GENCMD_PATH.toString(), "measure_clock", "arm");
//                    if (freqOutput.contains("=")) {
//                        String freqStr = freqOutput.split("=")[1].trim();
//                        try {
//                            long freq = Long.parseLong(freqStr);
//                            cpuInfo.setCurrentFrequency(freq);
//                            cpuInfo.setMaxFrequency(freq);
//                        } catch (NumberFormatException e) {
//                            log.debug("Error parsing frequency from vcgencmd", e);
//                        }
//                    }
//                } catch (Exception e) {
//                    log.debug("Error getting frequency from vcgencmd", e);
//                }
//
//                // Get CPU load
//                String loadOutput = exec("top", "-bn1");
//                if (!loadOutput.isEmpty()) {
//                    // Parse CPU load from top output
//                    String[] lines = loadOutput.split("\n");
//                    for (String line : lines) {
//                        if (line.contains("Cpu(s):")) {
//                            String[] parts = line.split(":");
//                            if (parts.length > 1) {
//                                String cpuUsage = parts[1].split("%")[0].trim();
//                                try {
//                                    double usage = Double.parseDouble(cpuUsage);
//                                    cpuInfo.setLoadPercentage((int) usage);
//                                } catch (NumberFormatException e) {
//                                    log.debug("Error parsing CPU usage", e);
//                                }
//                                break;
//                            }
//                        }
//                    }
//                }
//
//                // Get individual core loads
//                List<CpuCore> cores = new ArrayList<>();
//                if (cpuInfo.getNoOfCores() != null) {
//                    for (int i = 0; i < cpuInfo.getNoOfCores(); i++) {
//                        CpuCore core = CpuCore.builder()
//                                .coreId(i)
//                                .load(cpuInfo.getLoadPercentage() != null ? cpuInfo.getLoadPercentage() / cpuInfo.getNoOfCores() : 0)
//                                .vendor(cpuInfo.getVendor())
//                                .build();
//                        cores.add(core);
//                    }
//                }
//                cpuInfo.setCores(cores);
//            }
//
//            log.debug("CPU information collected successfully");
//
//        } catch (Exception e) {
//            log.warn("Error collecting CPU information", e);
//        }
//
//        return cpuInfo;
//    }
//
//    @Override
//    public MemoryInfo getMemoryInfo() {
//        log.debug("Collecting memory information for Raspberry Pi");
//
//        MemoryInfo memoryInfo = MemoryInfo.builder().build();
//
//        try {
//            String memInfoStr = readFileSafe(MEM_INFO_PATH);
//            if (!memInfoStr.isEmpty()) {
//                Map<String, String> memMap = parseKeyValueOutput(memInfoStr, ":");
//
//                long totalMem = getLongValue(memMap.get("MemTotal"));
//                long freeMem = getLongValue(memMap.get("MemFree"));
//                long buffers = getLongValue(memMap.get("Buffers"));
//                long cached = getLongValue(memMap.get("Cached"));
//                long sReclaimable = getLongValue(memMap.get("SReclaimable"));
//                long swapTotal = getLongValue(memMap.get("SwapTotal"));
//                long swapFree = getLongValue(memMap.get("SwapFree"));
//
//                // Calculate used memory (total - free - buffers - cache)
//                long usedMem = totalMem - freeMem - buffers - cached - sReclaimable;
//                if (usedMem < 0) usedMem = 0;
//
//                long swapUsed = swapTotal - swapFree;
//
//                double usedPercent = calculatePercentage(usedMem, totalMem);
//
//                memoryInfo.setTotalBytes(totalMem * 1024); // Convert from KB to bytes
//                memoryInfo.setFreeBytes(freeMem * 1024);
//                memoryInfo.setUsedBytes(usedMem * 1024);
//                memoryInfo.setSwapTotal(swapTotal * 1024);
//                memoryInfo.setSwapFree(swapFree * 1024);
//                memoryInfo.setSwapUsed(swapUsed * 1024);
//                memoryInfo.setBuffers(buffers * 1024);
//                memoryInfo.setCached(cached * 1024);
//                memoryInfo.setShared(0L); // Not directly available
//                memoryInfo.setAvailable((freeMem + buffers + cached) * 1024);
//
//                memoryInfo.setTotalFormatted(formatBytes(memoryInfo.getTotalBytes()));
//                memoryInfo.setFreeFormatted(formatBytes(memoryInfo.getFreeBytes()));
//                memoryInfo.setUsedFormatted(formatBytes(memoryInfo.getUsedBytes()));
//                memoryInfo.setUsedPercent(String.format("%.1f", usedPercent));
//
//                // Add Java memory info
//                addJavaMemoryInfo(memoryInfo);
//            }
//
//            log.debug("Memory information collected successfully");
//
//        } catch (Exception e) {
//            log.warn("Error collecting memory information", e);
//        }
//
//        return memoryInfo;
//    }
//
//    @Override
//    public DiskInfo getDiskInfo() {
//        log.debug("Collecting disk information for Raspberry Pi");
//
//        DiskInfo diskInfo = DiskInfo.builder().build();
//
//        try {
//            // Use df command to get disk information
//            String dfOutput = exec("df", "-B1", "--output=source,fstype,size,used,avail,target,pcent");
//            List<DriveInfo> drives = new ArrayList<>();
//
//            if (!dfOutput.isEmpty()) {
//                String[] lines = dfOutput.split("\n");
//                for (int i = 1; i < lines.length; i++) { // Skip header
//                    String line = lines[i].trim();
//                    if (!line.isEmpty()) {
//                        String[] parts = line.split("\\s+");
//                        if (parts.length >= 7) {
//                            try {
//                                DriveInfo drive = DriveInfo.builder()
//                                        .device(parts[0])
//                                        .fileSystem(parts[1])
//                                        .totalBytes(Long.parseLong(parts[2]))
//                                        .usedBytes(Long.parseLong(parts[3]))
//                                        .freeBytes(Long.parseLong(parts[4]))
//                                        .mountPoint(parts[5])
//                                        .usedPercent(parts[6].replace("%", ""))
//                                        .totalFormatted(formatBytes(Long.parseLong(parts[2])))
//                                        .usedFormatted(formatBytes(Long.parseLong(parts[3])))
//                                        .freeFormatted(formatBytes(Long.parseLong(parts[4])))
//                                        .type(determineDriveType(parts[0], parts[5]))
//                                        .build();
//                                drives.add(drive);
//                            } catch (NumberFormatException e) {
//                                log.debug("Error parsing df output line: {}", line, e);
//                            }
//                        }
//                    }
//                }
//            }
//
//            // Calculate totals
//            long totalSpace = drives.stream().mapToLong(DriveInfo::getTotalBytes).sum();
//            long freeSpace = drives.stream().mapToLong(DriveInfo::getFreeBytes).sum();
//            long usedSpace = drives.stream().mapToLong(DriveInfo::getUsedBytes).sum();
//
//            diskInfo.setDrives(drives);
//            diskInfo.setDriveCount(drives.size());
//            diskInfo.setTotalSpace(totalSpace);
//            diskInfo.setFreeSpace(freeSpace);
//            diskInfo.setUsedSpace(usedSpace);
//            diskInfo.setTotalSpaceFormatted(formatBytes(totalSpace));
//            diskInfo.setFreeSpaceFormatted(formatBytes(freeSpace));
//            diskInfo.setUsedSpaceFormatted(formatBytes(usedSpace));
//
//            log.debug("Disk information collected successfully");
//
//        } catch (Exception e) {
//            log.warn("Error collecting disk information", e);
//            diskInfo.setError("Error: " + e.getMessage());
//        }
//
//        return diskInfo;
//    }
//
//    @Override
//    public NetworkInfo getNetworkInfo() {
//        log.debug("Collecting network information for Raspberry Pi");
//
//        NetworkInfo networkInfo = NetworkInfo.builder().build();
//
//        try {
//            // Get hostname
//            String hostname = exec("hostname");
//            networkInfo.setHostname(hostname.trim());
//
//            // Get domain
//            String domain = exec("hostname", "-d");
//            if (domain.isEmpty()) {
//                domain = "local";
//            }
//            networkInfo.setDomain(domain.trim());
//
//            // Get network adapters using ip command
//            String ipOutput = exec("ip", "-o", "-4", "addr", "show");
//            List<NetworkAdapter> adapters = new ArrayList<>();
//            Set<String> processedInterfaces = new HashSet<>();
//
//            if (!ipOutput.isEmpty()) {
//                String[] lines = ipOutput.split("\n");
//                for (String line : lines) {
//                    String[] parts = line.trim().split("\\s+");
//                    if (parts.length >= 4) {
//                        String interfaceName = parts[1];
//
//                        // Skip if already processed
//                        if (processedInterfaces.contains(interfaceName)) {
//                            continue;
//                        }
//
//                        String ipAddress = parts[3].split("/")[0];
//                        String status = "Up"; // ip command only shows active interfaces
//
//                        // Get MAC address
//                        String macAddress = "";
//                        try {
//                            String macOutput = readFileSafe(Path.of("/sys/class/net/" + interfaceName + "/address"));
//                            if (!macOutput.isEmpty()) {
//                                macAddress = macOutput.trim();
//                            }
//                        } catch (Exception e) {
//                            log.debug("Error getting MAC address for {}", interfaceName, e);
//                        }
//
//                        // Get additional IP addresses
//                        List<String> ipAddresses = new ArrayList<>();
//                        ipAddresses.add(ipAddress);
//
//                        // Get network statistics
//                        long bytesReceived = 0;
//                        long bytesSent = 0;
//                        try {
//                            String rxBytes = readFileSafe(Path.of("/sys/class/net/" + interfaceName + "/statistics/rx_bytes"));
//                            String txBytes = readFileSafe(Path.of("/sys/class/net/" + interfaceName + "/statistics/tx_bytes"));
//                            bytesReceived = getLongValue(rxBytes);
//                            bytesSent = getLongValue(txBytes);
//                        } catch (Exception e) {
//                            log.debug("Error getting network statistics for {}", interfaceName, e);
//                        }
//
//                        NetworkAdapter adapter = NetworkAdapter.builder()
//                                .name(interfaceName)
//                                .description("Network Interface")
//                                .macAddress(macAddress)
//                                .ipAddress(ipAddress)
//                                .status(status)
//                                .ipAddresses(ipAddresses)
//                                .bytesReceived(bytesReceived)
//                                .bytesSent(bytesSent)
//                                .build();
//
//                        adapters.add(adapter);
//                        processedInterfaces.add(interfaceName);
//                    }
//                }
//            }
//
//            // Get DNS servers
//            List<String> dnsServers = new ArrayList<>();
//            try {
//                String resolvConf = readFileSafe(Path.of("/etc/resolv.conf"));
//                if (!resolvConf.isEmpty()) {
//                    String[] lines = resolvConf.split("\n");
//                    for (String line : lines) {
//                        if (line.startsWith("nameserver")) {
//                            String dns = line.split("\\s+")[1].trim();
//                            dnsServers.add(dns);
//                        }
//                    }
//                }
//            } catch (Exception e) {
//                log.debug("Error getting DNS servers", e);
//            }
//
//            // Get default gateway
//            String gateway = "";
//            try {
//                String routeOutput = exec("ip", "route");
//                if (!routeOutput.isEmpty()) {
//                    String[] lines = routeOutput.split("\n");
//                    for (String line : lines) {
//                        if (line.contains("default via")) {
//                            gateway = line.split("\\s+")[2];
//                            break;
//                        }
//                    }
//                }
//            } catch (Exception e) {
//                log.debug("Error getting default gateway", e);
//            }
//
//            // Get all IP addresses
//            List<String> allIps = adapters.stream()
//                    .flatMap(adapter -> adapter.getIpAddresses().stream())
//                    .collect(Collectors.toList());
//
//            networkInfo.setAdapters(adapters);
//            networkInfo.setAdapterCount(adapters.size());
//            networkInfo.setDnsServers(dnsServers);
//            networkInfo.setDefaultGateway(gateway);
//            networkInfo.setIpAddresses(allIps);
//            networkInfo.setBytesReceived(adapters.stream().mapToLong(NetworkAdapter::getBytesReceived).sum());
//            networkInfo.setBytesSent(adapters.stream().mapToLong(NetworkAdapter::getBytesSent).sum());
//
//            log.debug("Network information collected successfully");
//
//        } catch (Exception e) {
//            log.warn("Error collecting network information", e);
//        }
//
//        return networkInfo;
//    }
//
//    @Override
//    public List<ProcessInfo> getRunningProcesses() {
//        log.debug("Collecting running processes for Raspberry Pi");
//
//        List<ProcessInfo> processes = new ArrayList<>();
//
//        try {
//            // Use ps command to get process information
//            String psOutput = exec("ps", "-eo", "pid,ppid,user,pcpu,pmem,rss,vsz,state,comm,cmd", "--sort=-pcpu");
//
//            if (!psOutput.isEmpty()) {
//                String[] lines = psOutput.split("\n");
//                for (int i = 1; i < lines.length && i <= 50; i++) { // Skip header and limit to 50 processes
//                    String line = lines[i].trim();
//                    if (!line.isEmpty()) {
//                        String[] parts = line.split("\\s+", 10);
//                        if (parts.length >= 10) {
//                            try {
//                                ProcessInfo process = ProcessInfo.builder()
//                                        .pid(Integer.parseInt(parts[0]))
//                                        .ppid(Integer.parseInt(parts[1]))
//                                        .user(parts[2])
//                                        .cpuUsage(Double.parseDouble(parts[3]))
//                                        .memoryBytes(Long.parseLong(parts[5]) * 1024) // RSS in KB to bytes
//                                        .memoryFormatted(formatBytes(Long.parseLong(parts[5]) * 1024))
//                                        .state(parts[7])
//                                        .name(parts[8])
//                                        .commandLine(parts[9])
//                                        .residentMemory(Long.parseLong(parts[5]) * 1024)
//                                        .virtualMemory(Long.parseLong(parts[6]) * 1024) // VSZ in KB to bytes
//                                        .build();
//                                processes.add(process);
//                            } catch (NumberFormatException e) {
//                                log.debug("Error parsing process line: {}", line, e);
//                            }
//                        }
//                    }
//                }
//            }
//
//            log.debug("Collected {} running processes", processes.size());
//
//        } catch (Exception e) {
//            log.warn("Error collecting running processes", e);
//        }
//
//        return processes;
//    }
//
//    @Override
//    public List<ServiceInfo> getRunningServices() {
//        log.debug("Collecting running services for Raspberry Pi");
//
//        List<ServiceInfo> services = new ArrayList<>();
//
//        try {
//            // Use systemctl to get service information
//            String systemctlOutput = exec("systemctl", "list-units", "--type=service", "--all", "--no-pager");
//
//            if (!systemctlOutput.isEmpty()) {
//                String[] lines = systemctlOutput.split("\n");
//                for (String line : lines) {
//                    if (line.contains(".service")) {
//                        String[] parts = line.trim().split("\\s+");
//                        if (parts.length >= 5) {
//                            String unitName = parts[0];
//                            String loadState = parts[1];
//                            String activeState = parts[2];
//                            String subState = parts[3];
//                            String description = String.join(" ", Arrays.copyOfRange(parts, 4, parts.length));
//
//                            // Determine overall status
//                            String status = switch (activeState) {
//                                case "active" -> subState.equals("running") ? "Running" : "Active";
//                                case "inactive" -> "Stopped";
//                                case "failed" -> "Failed";
//                                default -> "Unknown";
//                            };
//
//                            ServiceInfo service = ServiceInfo.builder()
//                                    .name(unitName.replace(".service", ""))
//                                    .displayName(description)
//                                    .description(description)
//                                    .status(status)
//                                    .startType(loadState.equals("loaded") ? "Enabled" : "Disabled")
//                                    .user("root") // Most services run as root
//                                    .build();
//
//                            services.add(service);
//                        }
//                    }
//                }
//            }
//
//            log.debug("Collected {} services", services.size());
//
//        } catch (Exception e) {
//            log.warn("Error collecting running services", e);
//        }
//
//        return services;
//    }
//
//    @Override
//    public PerformanceMetrics getPerformanceMetrics() {
//        log.debug("Collecting performance metrics for Raspberry Pi");
//
//        PerformanceMetrics metrics = PerformanceMetrics.builder().build();
//
//        try {
//            // Get CPU load averages
//            String loadAvg = readFileSafe(Path.of("/proc/loadavg"));
//            if (!loadAvg.isEmpty()) {
//                String[] parts = loadAvg.split("\\s+");
//                if (parts.length >= 3) {
//                    metrics.setCpuLoad1Min(Double.parseDouble(parts[0]));
//                    metrics.setCpuLoad5Min(Double.parseDouble(parts[1]));
//                    metrics.setCpuLoad15Min(Double.parseDouble(parts[2]));
//                }
//            }
//
//            // Get memory load from /proc/meminfo
//            MemoryInfo memory = getMemoryInfo();
//            if (memory.getUsedPercent() != null) {
//                try {
//                    metrics.setMemoryLoadPercent(Double.parseDouble(memory.getUsedPercent()));
//                } catch (NumberFormatException e) {
//                    log.debug("Error parsing memory load percent", e);
//                }
//            }
//
//            // Get process count
//            String processCount = exec("ps", "-e", "--no-headers");
//            if (!processCount.isEmpty()) {
//                metrics.setProcessCount(processCount.split("\n").length);
//            }
//
//            // Get thread count
//            String threadCount = exec("ps", "-eL", "--no-headers");
//            if (!threadCount.isEmpty()) {
//                metrics.setThreadCount(threadCount.split("\n").length);
//            }
//
//            // Get system uptime
//            String uptimeStr = readFileSafe(Path.of("/proc/uptime"));
//            if (!uptimeStr.isEmpty()) {
//                String uptimeSeconds = uptimeStr.split("\\s+")[0];
//                try {
//                    long seconds = (long) Double.parseDouble(uptimeSeconds);
//                    metrics.setUptimeSeconds(seconds);
//
//                    // Format uptime
//                    long days = seconds / (24 * 3600);
//                    seconds %= (24 * 3600);
//                    long hours = seconds / 3600;
//                    seconds %= 3600;
//                    long minutes = seconds / 60;
//
//                    StringBuilder uptime = new StringBuilder();
//                    if (days > 0) uptime.append(days).append("d ");
//                    if (hours > 0) uptime.append(hours).append("h ");
//                    if (minutes > 0) uptime.append(minutes).append("m");
//                    if (uptime.isEmpty()) uptime.append(seconds).append("s");
//
//                    metrics.setUptime(uptime.toString());
//                } catch (NumberFormatException e) {
//                    log.debug("Error parsing uptime", e);
//                }
//            }
//
//            // Get disk I/O statistics
//            String diskStats = readFileSafe(Path.of("/proc/diskstats"));
//            if (!diskStats.isEmpty()) {
//                // Simple disk I/O load calculation
//                long totalIO = 0;
//                String[] lines = diskStats.split("\n");
//                for (String line : lines) {
//                    String[] parts = line.trim().split("\\s+");
//                    if (parts.length >= 11) {
//                        long reads = Long.parseLong(parts[3]);
//                        long writes = Long.parseLong(parts[7]);
//                        totalIO += reads + writes;
//                    }
//                }
//                // Simple heuristic for disk load
//                metrics.setDiskIOLoad(Math.min(100.0, totalIO / 1000.0));
//            }
//
//            // Get network statistics
//            NetworkInfo network = getNetworkInfo();
//            metrics.setNetworkBytesIn(network.getBytesReceived());
//            metrics.setNetworkBytesOut(network.getBytesSent());
//
//            log.debug("Performance metrics collected successfully");
//
//        } catch (Exception e) {
//            log.warn("Error collecting performance metrics", e);
//        }
//
//        return metrics;
//    }
//
//    @Override
//    public TemperatureInfo getTemperatureInfo() {
//        log.debug("Collecting temperature information for Raspberry Pi");
//
//        TemperatureInfo tempInfo = TemperatureInfo.builder()
//                .hasTemperatureSensors(true)
//                .monitoringSoftware("vcgencmd / sysfs")
//                .build();
//
//        try {
//            List<TemperatureSensor> sensors = new ArrayList<>();
//
//            // Get CPU temperature
//            String cpuTempStr = readFileSafe(CPU_TEMP_PATH);
//            if (!cpuTempStr.isEmpty()) {
//                try {
//                    double cpuTempC = Double.parseDouble(cpuTempStr.trim()) / 1000.0;
//                    double cpuTempF = (cpuTempC * 9.0 / 5.0) + 32.0;
//
//                    TemperatureSensor cpuSensor = TemperatureSensor.builder()
//                            .name("CPU Temperature")
//                            .type("CPU")
//                            .temperatureC(cpuTempC)
//                            .temperatureF(cpuTempF)
//                            .status(cpuTempC > 80.0 ? "High" : cpuTempC > 70.0 ? "Warning" : "Normal")
//                            .location("SoC")
//                            .highThreshold(80.0)
//                            .criticalThreshold(85.0)
//                            .build();
//
//                    sensors.add(cpuSensor);
//                    tempInfo.setAverageTemperatureC(cpuTempC);
//                    tempInfo.setAverageTemperatureF(cpuTempF);
//                    tempInfo.setHighestSensor("CPU");
//                    tempInfo.setHighestTemperatureC(cpuTempC);
//                } catch (NumberFormatException e) {
//                    log.debug("Error parsing CPU temperature", e);
//                }
//            }
//
//            // Get GPU temperature if available
//            if (Files.exists(GPU_TEMP_PATH)) {
//                String gpuTempStr = readFileSafe(GPU_TEMP_PATH);
//                if (!gpuTempStr.isEmpty()) {
//                    try {
//                        double gpuTempC = Double.parseDouble(gpuTempStr.trim()) / 1000.0;
//                        double gpuTempF = (gpuTempC * 9.0 / 5.0) + 32.0;
//
//                        TemperatureSensor gpuSensor = TemperatureSensor.builder()
//                                .name("GPU Temperature")
//                                .type("GPU")
//                                .temperatureC(gpuTempC)
//                                .temperatureF(gpuTempF)
//                                .status(gpuTempC > 80.0 ? "High" : gpuTempC > 70.0 ? "Warning" : "Normal")
//                                .location("GPU Core")
//                                .highThreshold(80.0)
//                                .criticalThreshold(85.0)
//                                .build();
//
//                        sensors.add(gpuSensor);
//
//                        // Update highest temperature
//                        if (tempInfo.getHighestTemperatureC() == null || gpuTempC > tempInfo.getHighestTemperatureC()) {
//                            tempInfo.setHighestSensor("GPU");
//                            tempInfo.setHighestTemperatureC(gpuTempC);
//                        }
//                    } catch (NumberFormatException e) {
//                        log.debug("Error parsing GPU temperature", e);
//                    }
//                }
//            }
//
//            // Try to get throttling status
//            try {
//                String throttled = exec(GET_THROTTLED_STATUS);
//                if (throttled.contains("=")) {
//                    String hexValue = throttled.split("=")[1].trim();
//                    int throttledStatus = Integer.parseInt(hexValue.replace("0x", ""), 16);
//
//                    // Check throttling bits
//                    boolean underVoltage = (throttledStatus & 0x1) != 0;
//                    boolean armFreqCapped = (throttledStatus & 0x2) != 0;
//                    boolean throttling = (throttledStatus & 0x4) != 0;
//                    boolean softTempLimit = (throttledStatus & 0x8) != 0;
//
//                    String status = "Normal";
//                    if (softTempLimit) {
//                        status = "Temperature Limit Active";
//                    } else if (throttling) {
//                        status = "Throttling Active";
//                    } else if (underVoltage) {
//                        status = "Under Voltage";
//                    }
//
//                    // Add throttling as a virtual sensor
//                    TemperatureSensor throttleSensor = TemperatureSensor.builder()
//                            .name("Throttling Status")
//                            .type("System")
//                            .status(status)
//                            .location("SoC")
//                            .build();
//
//                    sensors.add(throttleSensor);
//                }
//            } catch (Exception e) {
//                log.debug("Error getting throttling status", e);
//            }
//
//            tempInfo.setSensors(sensors);
//
//            // Calculate average temperature if we have multiple sensors
//            if (sensors.size() > 1) {
//                double avgC = sensors.stream()
//                        .filter(s -> s.getTemperatureC() != null)
//                        .mapToDouble(TemperatureSensor::getTemperatureC)
//                        .average()
//                        .orElse(0.0);
//                double avgF = (avgC * 9.0 / 5.0) + 32.0;
//                tempInfo.setAverageTemperatureC(avgC);
//                tempInfo.setAverageTemperatureF(avgF);
//            }
//
//            log.debug("Temperature information collected successfully");
//
//        } catch (Exception e) {
//            log.warn("Error collecting temperature information", e);
//            tempInfo.setStatus("Error collecting temperature");
//            tempInfo.setError(e.getMessage());
//        }
//
//        return tempInfo;
//    }
//
//    @Override
//    public Object getHardwareDetails() {
//        log.debug("Collecting hardware details for Raspberry Pi");
//
//        Map<String, Object> hardwareDetails = new LinkedHashMap<>();
//
//        try {
//            // Audio devices
//            hardwareDetails.put("audioDevices", getAudioDevices());
//
//            // USB devices
//            hardwareDetails.put("usbDevices", getUsbDevices());
//
//            // Storage controllers
//            hardwareDetails.put("storageControllers", getStorageControllers());
//
//            // Motherboard info (from device tree)
//            hardwareDetails.put("motherboard", getMotherboardInfo());
//
//            log.debug("Hardware details collected successfully");
//
//        } catch (Exception e) {
//            log.warn("Error collecting hardware details", e);
//            hardwareDetails.put("error", e.getMessage());
//        }
//
//        return hardwareDetails;
//    }
//
//    @Override
//    public ServerInfo getServerInfo() {
//        log.debug("Collecting server information for Raspberry Pi");
//
//        ServerInfo serverInfo = ServerInfo.builder().build();
//
//        try {
//            // Get OS information from /etc/os-release
//            Path osReleasePath = Path.of("/etc/os-release");
//            if (Files.exists(osReleasePath)) {
//                String osRelease = readFileSafe(osReleasePath);
//                Map<String, String> osInfo = parseKeyValueOutput(osRelease, "=");
//
//                serverInfo.setOsName(getStringValue(osInfo.get("PRETTY_NAME"), "Raspberry Pi OS"));
//                serverInfo.setDistribution(getStringValue(osInfo.get("NAME"), "Raspberry Pi OS"));
//                serverInfo.setDistributionVersion(getStringValue(osInfo.get("VERSION_ID"), ""));
//
//                // Remove quotes from values
//                serverInfo.setOsName(serverInfo.getOsName().replace("\"", ""));
//                serverInfo.setDistribution(serverInfo.getDistribution().replace("\"", ""));
//            }
//
//            // Get kernel version
//            String kernelVersion = readFileSafe(VERSION_PATH);
//            if (!kernelVersion.isEmpty()) {
//                serverInfo.setKernelVersion(kernelVersion.split("\\s+")[2]); // Extract version number
//            }
//
//            // Get architecture
//            serverInfo.setOsArchitecture(System.getProperty("os.arch"));
//
//            // Get hostname
//            serverInfo.setHostname(exec("hostname").trim());
//
//            // Get model from device tree
//            String model = readFileSafe(DEVICE_TREE_MODEL_PATH);
//            if (!model.isEmpty()) {
//                serverInfo.setModel(model.trim());
//            }
//
//            // Get serial number
//            String serial = readFileSafe(DEVICE_TREE_SERIAL_PATH);
//            if (!serial.isEmpty()) {
//                serverInfo.setSerialNumber(serial.trim());
//            }
//
//            // Get manufacturer
//            serverInfo.setManufacturer("Raspberry Pi Foundation");
//
//            // Get uptime
//            String uptimeStr = readFileSafe(Path.of("/proc/uptime"));
//            if (!uptimeStr.isEmpty()) {
//                String uptimeSeconds = uptimeStr.split("\\s+")[0];
//                try {
//                    long seconds = (long) Double.parseDouble(uptimeSeconds);
//                    long days = seconds / (24 * 3600);
//                    seconds %= (24 * 3600);
//                    long hours = seconds / 3600;
//                    seconds %= 3600;
//                    long minutes = seconds / 60;
//
//                    StringBuilder uptime = new StringBuilder();
//                    if (days > 0) uptime.append(days).append(" days ");
//                    if (hours > 0) uptime.append(hours).append(" hours ");
//                    if (minutes > 0) uptime.append(minutes).append(" minutes");
//                    if (uptime.isEmpty()) uptime.append(seconds).append(" seconds");
//
//                    serverInfo.setUptime(uptime.toString());
//                } catch (NumberFormatException e) {
//                    log.debug("Error parsing uptime", e);
//                }
//            }
//
//            // Get boot time (calculate from uptime)
//            if (serverInfo.getUptime() != null) {
//                try {
//                    String uptimeSeconds = uptimeStr.split("\\s+")[0];
//                    long seconds = (long) Double.parseDouble(uptimeSeconds);
//                    long bootTimeMillis = System.currentTimeMillis() - (seconds * 1000);
//                    serverInfo.setBootTime(new Date(bootTimeMillis).toString());
//                } catch (Exception e) {
//                    log.debug("Error calculating boot time", e);
//                }
//            }
//
//            // Desktop environment (if any)
//            String desktopEnv = System.getenv("XDG_CURRENT_DESKTOP");
//            if (desktopEnv == null || desktopEnv.isEmpty()) {
//                desktopEnv = System.getenv("DESKTOP_SESSION");
//            }
//            serverInfo.setDesktopEnvironment(desktopEnv != null ? desktopEnv : "Unknown");
//
//            log.debug("Server information collected successfully");
//
//        } catch (Exception e) {
//            log.warn("Error collecting server information", e);
//        }
//
//        return serverInfo;
//    }
//
//    @Override
//    public BiosInfo getBiosInfo() {
//        log.debug("Collecting BIOS information for Raspberry Pi");
//
//        BiosInfo biosInfo = BiosInfo.builder().build();
//
//        try {
//            // Raspberry Pi doesn't have a traditional BIOS, but has firmware
//            // Get firmware version using vcgencmd
//            String firmwareVersion = exec(VC_GENCMD_PATH.toString(), "version");
//            if (!firmwareVersion.isEmpty()) {
//                biosInfo.setVersion(firmwareVersion.trim());
//            }
//
//            // Vendor is typically Broadcom for Raspberry Pi
//            biosInfo.setVendor("Broadcom");
//
//            // Get firmware date/release if possible
//            try {
//                String vcgencmdDate = exec(VC_GENCMD_PATH.toString(), "version");
//                if (vcgencmdDate.contains("version")) {
//                    // Try to extract date from version string
//                    biosInfo.setReleaseDate(Instant.now().toString()); // Default to current time
//                }
//            } catch (Exception e) {
//                log.debug("Error getting firmware date", e);
//            }
//
//            // Firmware revision
//            biosInfo.setFirmwareRevision(getStringValue(exec(VC_GENCMD_PATH.toString(), "get_config", "int"), "Unknown"));
//
//            log.debug("BIOS information collected successfully");
//
//        } catch (Exception e) {
//            log.warn("Error collecting BIOS information", e);
//        }
//
//        return biosInfo;
//    }
//
//    @Override
//    public Object getOsSpecificInfo() {
//        log.debug("Collecting OS-specific information for Raspberry Pi");
//
//        Map<String, Object> osSpecific = new LinkedHashMap<>();
//
//        try {
//            // Raspberry Pi specific configurations
//
//            // 1. Overclock settings from config.txt
//            osSpecific.put("overclockSettings", getOverclockSettings());
//
//            // 2. Raspberry Pi configuration (raspi-config settings)
//            osSpecific.put("raspiConfig", getRaspiConfig());
//
//            // 3. Pi-specific features
//            osSpecific.put("piFeatures", getPiFeatures());
//
//            // 4. Performance tuning
//            osSpecific.put("performanceTuning", getPerformanceTuning());
//
//            log.debug("OS-specific information collected successfully");
//
//        } catch (Exception e) {
//            log.warn("Error collecting OS-specific information", e);
//            osSpecific.put("error", e.getMessage());
//        }
//
//        return osSpecific;
//    }
//
//    /* ============================================
//       HELPER METHODS FOR RASPBERRY PI
//       ============================================ */
//
//    private String extractFromCpuInfo(String cpuInfo, String key) {
//        if (cpuInfo == null || key == null) return null;
//
//        String[] lines = cpuInfo.split("\n");
//        for (String line : lines) {
//            if (line.trim().startsWith(key + ":")) {
//                return line.split(":")[1].trim();
//            }
//        }
//        return null;
//    }
//
//    private String extractFromMemInfo(String memInfo, String key) {
//        if (memInfo == null || key == null) return null;
//
//        String[] lines = memInfo.split("\n");
//        for (String line : lines) {
//            if (line.trim().startsWith(key + ":")) {
//                return line.split(":")[1].trim();
//            }
//        }
//        return null;
//    }
//
//    private List<GpioPin> parseGpioOutput(String output) {
//        List<GpioPin> pins = new ArrayList<>();
//
//        try {
//            String[] lines = output.split("\n");
//            for (String line : lines) {
//                if (line.contains("GPIO")) {
//                    String[] parts = line.split("\\s+");
//                    if (parts.length >= 4) {
//                        GpioPin pin = GpioPin.builder()
//                                .pin(Integer.parseInt(parts[1].replace("GPIO", "").trim()))
//                                .name(parts[1])
//                                .mode(parts[2])
//                                .value(parts[3])
//                                .function(parts.length > 4 ? parts[4] : "")
//                                .physicalPin("") // Would need mapping
//                                .bcmPin(parts[1].replace("GPIO", "").trim())
//                                .build();
//                        pins.add(pin);
//                    }
//                }
//            }
//        } catch (Exception e) {
//            log.debug("Error parsing GPIO output", e);
//        }
//
//        return pins;
//    }
//
//    private List<GpioPin> createDefaultGpioPins() {
//        List<GpioPin> pins = new ArrayList<>();
//
//        // Standard Raspberry Pi GPIO pins (BCM numbering)
//        int[] commonPins = {2, 3, 4, 14, 15, 17, 18, 27, 22, 23, 24, 10, 9, 25, 11, 8, 7, 5, 6, 12, 13, 19, 16, 26, 20, 21};
//
//        for (int pin : commonPins) {
//            GpioPin gpioPin = GpioPin.builder()
//                    .pin(pin)
//                    .name("GPIO" + pin)
//                    .mode("IN")
//                    .value("0")
//                    .function("GPIO")
//                    .bcmPin(String.valueOf(pin))
//                    .build();
//            pins.add(gpioPin);
//        }
//
//        return pins;
//    }
//
//    private List<HatGpioMapping> parseHatGpioMappings() {
//        List<HatGpioMapping> mappings = new ArrayList<>();
//
//        try {
//            // Read GPIO mapping from device tree
//            Path gpioMapPath = Path.of("/proc/device-tree/hat/gpio-map");
//            if (Files.exists(gpioMapPath)) {
//                byte[] data = Files.readAllBytes(gpioMapPath);
//                // Parse binary data (simplified)
//                // In reality, this would need proper parsing of device tree binary
//
//                // Add some example mappings
//                mappings.add(HatGpioMapping.builder()
//                        .function("LED")
//                        .pin(13)
//                        .description("Status LED")
//                        .activeLow(false)
//                        .build());
//
//                mappings.add(HatGpioMapping.builder()
//                        .function("BUTTON")
//                        .pin(26)
//                        .description("User Button")
//                        .activeLow(true)
//                        .build());
//            }
//        } catch (Exception e) {
//            log.debug("Error parsing HAT GPIO mappings", e);
//        }
//
//        return mappings;
//    }
//
//    private String determineDriveType(String device, String mountPoint) {
//        if (device.startsWith("/dev/mmcblk")) {
//            return "SD Card";
//        } else if (device.startsWith("/dev/sd") || device.startsWith("/dev/hd")) {
//            return "USB Drive";
//        } else if (device.startsWith("/dev/nvme")) {
//            return "NVMe SSD";
//        } else if (mountPoint.equals("/")) {
//            return "System Drive";
//        } else if (mountPoint.startsWith("/media/") || mountPoint.startsWith("/mnt/")) {
//            return "External Storage";
//        }
//        return "Unknown";
//    }
//
//    private List<Map<String, Object>> getAudioDevices() {
//        List<Map<String, Object>> audioDevices = new ArrayList<>();
//
//        try {
//            // Check for audio devices using aplay
//            String aplayOutput = exec("aplay", "-l");
//            if (!aplayOutput.isEmpty()) {
//                String[] lines = aplayOutput.split("\n");
//                for (String line : lines) {
//                    if (line.contains("card")) {
//                        Map<String, Object> device = new HashMap<>();
//                        device.put("name", line.trim());
//                        device.put("manufacturer", "Unknown");
//                        device.put("status", "OK");
//                        audioDevices.add(device);
//                    }
//                }
//            }
//
//            // If no devices found, add default
//            if (audioDevices.isEmpty()) {
//                Map<String, Object> defaultAudio = new HashMap<>();
//                defaultAudio.put("name", "Built-in Audio");
//                defaultAudio.put("manufacturer", "Broadcom");
//                defaultAudio.put("status", "OK");
//                audioDevices.add(defaultAudio);
//            }
//        } catch (Exception e) {
//            log.debug("Error getting audio devices", e);
//        }
//
//        return audioDevices;
//    }
//
//    private List<Map<String, Object>> getUsbDevices() {
//        List<Map<String, Object>> usbDevices = new ArrayList<>();
//
//        try {
//            // Use lsusb to get USB devices
//            String lsusbOutput = exec("lsusb");
//            if (!lsusbOutput.isEmpty()) {
//                String[] lines = lsusbOutput.split("\n");
//                for (String line : lines) {
//                    Map<String, Object> device = new HashMap<>();
//                    device.put("description", line.trim());
//                    usbDevices.add(device);
//                }
//            }
//        } catch (Exception e) {
//            log.debug("Error getting USB devices", e);
//        }
//
//        return usbDevices;
//    }
//
//    private List<Map<String, Object>> getStorageControllers() {
//        List<Map<String, Object>> controllers = new ArrayList<>();
//
//        try {
//            // Raspberry Pi typically has MMC/SD controller
//            Map<String, Object> mmcController = new HashMap<>();
//            mmcController.put("name", "MMC/SD Host Controller");
//            mmcController.put("manufacturer", "Broadcom");
//            mmcController.put("driverVersion", "Unknown");
//            controllers.add(mmcController);
//
//            // Check for USB storage controllers
//            String lspciOutput = exec("lspci");
//            if (!lspciOutput.isEmpty()) {
//                String[] lines = lspciOutput.split("\n");
//                for (String line : lines) {
//                    if (line.contains("USB controller") || line.contains("SATA controller")) {
//                        Map<String, Object> controller = new HashMap<>();
//                        controller.put("name", line.trim());
//                        controller.put("manufacturer", "Unknown");
//                        controllers.add(controller);
//                    }
//                }
//            }
//        } catch (Exception e) {
//            log.debug("Error getting storage controllers", e);
//        }
//
//        return controllers;
//    }
//
//    private Map<String, Object> getMotherboardInfo() {
//        Map<String, Object> motherboard = new HashMap<>();
//
//        try {
//            motherboard.put("manufacturer", "Raspberry Pi Foundation");
//
//            // Get model from device tree
//            String model = readFileSafe(DEVICE_TREE_MODEL_PATH);
//            if (!model.isEmpty()) {
//                motherboard.put("product", model.trim());
//            }
//
//            // Get serial number
//            String serial = readFileSafe(DEVICE_TREE_SERIAL_PATH);
//            if (!serial.isEmpty()) {
//                motherboard.put("serial", serial.trim());
//            }
//
//            // Get revision
//            String cpuInfo = readFileSafe(CPU_INFO_PATH);
//            String revision = extractFromCpuInfo(cpuInfo, "Revision");
//            if (revision != null) {
//                motherboard.put("version", revision);
//            }
//
//            // BIOS version (firmware)
//            String firmwareVersion = exec(VC_GENCMD_PATH.toString(), "version");
//            if (!firmwareVersion.isEmpty()) {
//                motherboard.put("biosVersion", firmwareVersion.trim());
//            }
//
//        } catch (Exception e) {
//            log.debug("Error getting motherboard info", e);
//        }
//
//        return motherboard;
//    }
//
//    private Map<String, Object> getOverclockSettings() {
//        Map<String, Object> overclock = new HashMap<>();
//
//        try {
//            if (Files.exists(CONFIG_TXT_PATH)) {
//                String config = readFileSafe(CONFIG_TXT_PATH);
//
//                // Parse common overclock settings
//                String[] settings = {
//                        "arm_freq", "core_freq", "sdram_freq", "over_voltage",
//                        "over_voltage_sdram", "gpu_freq", "force_turbo",
//                        "initial_turbo", "arm_freq_min", "core_freq_min"
//                };
//
//                for (String setting : settings) {
//                    if (config.contains(setting + "=")) {
//                        String value = config.split(setting + "=")[1].split("\n")[0].trim();
//                        overclock.put(setting, value);
//                    }
//                }
//            }
//        } catch (Exception e) {
//            log.debug("Error getting overclock settings", e);
//        }
//
//        return overclock;
//    }
//
//    private Map<String, Object> getRaspiConfig() {
//        Map<String, Object> raspiConfig = new HashMap<>();
//
//        try {
//            // Get current raspi-config settings
//            List<String> settings = execLines("raspi-config", "nonint", "get_config");
//
//            for (String line : settings) {
//                if (line.contains("=")) {
//                    String[] parts = line.split("=", 2);
//                    raspiConfig.put(parts[0].trim(), parts[1].trim());
//                }
//            }
//        } catch (Exception e) {
//            log.debug("Error getting raspi-config settings", e);
//        }
//
//        return raspiConfig;
//    }
//
//    private Map<String, Object> getPiFeatures() {
//        Map<String, Object> features = new HashMap<>();
//
//        try {
//            features.put("hasCamera", getCameraInfo().getCameraDetected());
//            features.put("hasWiFi", checkHasWifi());
//            features.put("hasBluetooth", checkHasBluetooth());
//            features.put("hasEthernet", checkHasEthernet());
//            features.put("hasAudioJack", true);
//            features.put("hasHDMI", true);
//            features.put("hasGPIO", true);
//            features.put("hasCSI", getCameraInfo().getCameraDetected());
//            features.put("hasDSI", Files.exists(Path.of("/proc/device-tree/display")));
//
//            // Check for PoE HAT
//            features.put("hasPoEHat", checkHasPoEHat());
//
//            // Check for fan
//            features.put("hasFan", checkHasFan());
//
//        } catch (Exception e) {
//            log.debug("Error getting Pi features", e);
//        }
//
//        return features;
//    }
//
//    private Map<String, Object> getPerformanceTuning() {
//        Map<String, Object> tuning = new HashMap<>();
//
//        try {
//            // Get current CPU governor
//            String governor = readFileSafe(Path.of("/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor"));
//            tuning.put("cpuGovernor", governor.trim());
//
//            // Get CPU frequency scaling info
//            String minFreq = readFileSafe(Path.of("/sys/devices/system/cpu/cpu0/cpufreq/scaling_min_freq"));
//            String maxFreq = readFileSafe(Path.of("/sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq"));
//            String curFreq = readFileSafe(Path.of("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq"));
//
//            tuning.put("minFrequency", minFreq.trim());
//            tuning.put("maxFrequency", maxFreq.trim());
//            tuning.put("currentFrequency", curFreq.trim());
//
//            // Get memory split
//            String memorySplit = exec(VC_GENCMD_PATH.toString(), "get_mem", "arm");
//            if (!memorySplit.isEmpty()) {
//                tuning.put("memorySplit", memorySplit.trim());
//            }
//
//            // Get GPU memory
//            String gpuMemory = exec(VC_GENCMD_PATH.toString(), "get_mem", "gpu");
//            if (!gpuMemory.isEmpty()) {
//                tuning.put("gpuMemory", gpuMemory.trim());
//            }
//
//        } catch (Exception e) {
//            log.debug("Error getting performance tuning", e);
//        }
//
//        return tuning;
//    }
//
//    private boolean checkHasWifi() {
//        try {
//            String wifiCheck = exec("iwconfig");
//            return !wifiCheck.isEmpty() && (wifiCheck.contains("wlan") || wifiCheck.contains("IEEE 802.11"));
//        } catch (Exception e) {
//            return false;
//        }
//    }
//
//    private boolean checkHasBluetooth() {
//        try {
//            String btCheck = exec("hciconfig");
//            return btCheck.contains("hci");
//        } catch (Exception e) {
//            return false;
//        }
//    }
//
//    private boolean checkHasEthernet() {
//        try {
//            String ethCheck = exec("ip", "link", "show");
//            return ethCheck.contains("eth");
//        } catch (Exception e) {
//            return false;
//        }
//    }
//
//    private boolean checkHasPoEHat() {
//        try {
//            // Check for PoE HAT by looking for specific I2C device or GPIO
//            String poeCheck = exec("i2cdetect", "-y", "1");
//            return poeCheck.contains("40");
//        } catch (Exception e) {
//            return false;
//        }
//    }
//
//    private boolean checkHasFan() {
//        try {
//            // Check for fan by looking at GPIO 18 (common fan control pin)
//            String fanCheck = exec("raspi-gpio", "get", "18");
//            return fanCheck.contains("OUT");
//        } catch (Exception e) {
//            return false;
//        }
//    }
//
//    /**
//     * Calculate health status specifically for Raspberry Pi.
//     */
//    private HealthStatus calculateHealthStatus(RaspberryPiServerInfo systemData) {
//        HealthStatus baseHealth = super.calculateHealthStatus(systemData);
//
//        try {
//            List<String> warnings = new ArrayList<>(baseHealth.getWarnings());
//            List<String> issues = new ArrayList<>(baseHealth.getIssues());
//            int score = baseHealth.getScore();
//
//            // Raspberry Pi specific health checks
//
//            // Check for under-voltage
//            String throttled = exec(GET_THROTTLED_STATUS);
//            if (throttled.contains("=")) {
//                String hexValue = throttled.split("=")[1].trim();
//                int throttledStatus = Integer.parseInt(hexValue.replace("0x", ""), 16);
//
//                if ((throttledStatus & 0x1) != 0) { // Under-voltage detected
//                    score -= 20;
//                    issues.add("UNDER-VOLTAGE DETECTED: Power supply may be insufficient");
//                }
//
//                if ((throttledStatus & 0x4) != 0) { // Throttling active
//                    score -= 15;
//                    warnings.add("CPU Throttling Active: System is being throttled due to temperature or power");
//                }
//            }
//
//            // Check SD card health (wear level)
//            try {
//                String mmcLife = readFileSafe(Path.of("/sys/block/mmcblk0/device/life_time"));
//                if (!mmcLife.isEmpty()) {
//                    try {
//                        int lifeTime = Integer.parseInt(mmcLife.trim(), 16);
//                        if (lifeTime > 0xA) { // 0xA = 80-90% life used
//                            score -= 10;
//                            warnings.add("SD Card wear level high: " + (lifeTime * 10) + "% of life used");
//                        }
//                    } catch (NumberFormatException e) {
//                        log.debug("Error parsing SD card life time", e);
//                    }
//                }
//            } catch (Exception e) {
//                // Ignore if file doesn't exist
//            }
//
//            // Check temperature
//            TemperatureInfo tempInfo = systemData.getTemperature();
//            if (tempInfo != null && tempInfo.getHighestTemperatureC() != null) {
//                double highestTemp = tempInfo.getHighestTemperatureC();
//                if (highestTemp > 85) {
//                    score -= 25;
//                    issues.add("CRITICAL TEMPERATURE: " + highestTemp + "°C - Risk of damage");
//                } else if (highestTemp > 80) {
//                    score -= 15;
//                    warnings.add("High Temperature: " + highestTemp + "°C - Consider adding cooling");
//                }
//            }
//
//            // Check for Pi-specific warnings
//            RaspberryPiInfo rpiInfo = systemData.getRaspberryPiInfo();
//            if (rpiInfo != null && rpiInfo.getWarrantyVoid() != null &&
//                    rpiInfo.getWarrantyVoid().equalsIgnoreCase("yes")) {
//                warnings.add("Warranty voided - Custom overclocking or modifications detected");
//            }
//
//            // Determine final health level
//            HealthStatus.HealthLevel level = getHealthLevel(score);
//
//            return HealthStatus.builder()
//                    .score(Math.max(0, score))
//                    .level(level)
//                    .warnings(warnings)
//                    .issues(issues)
//                    .recommendations(baseHealth.getRecommendations())
//                    .timestamp(System.currentTimeMillis())
//                    .build();
//
//        } catch (Exception e) {
//            log.debug("Error calculating Raspberry Pi health status", e);
//            return baseHealth;
//        }
//    }
//
//    private HealthStatus.HealthLevel getHealthLevel(int score) {
//        if (score >= 90) return HealthStatus.HealthLevel.EXCELLENT;
//        if (score >= 80) return HealthStatus.HealthLevel.GOOD;
//        if (score >= 70) return HealthStatus.HealthLevel.FAIR;
//        if (score >= 60) return HealthStatus.HealthLevel.POOR;
//        return HealthStatus.HealthLevel.CRITICAL;
//    }
//}