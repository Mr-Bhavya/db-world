package com.db.dbworld.services.server;

import com.db.dbworld.helpers.ProcessExecutor;
import com.db.dbworld.payloads.server.*;
import com.db.dbworld.stream.processor.GenericStreamProcessor;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.log4j.Log4j2;

import java.io.File;
import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.lang.management.RuntimeMXBean;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.*;

/**
 * Abstract base class for collecting system information.
 * Each OS-specific collector extends this class.
 */
@Log4j2
public abstract class ServerInfoCollector {

    protected static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    protected final ProcessExecutor processExecutor;
    protected final Runtime runtime = Runtime.getRuntime();

    protected ServerInfoCollector(ProcessExecutor processExecutor) {
        this.processExecutor = processExecutor;
        log.info("ServerInfoCollector initialized");
    }

    /* ============================================
       ABSTRACT METHODS - MUST BE IMPLEMENTED BY OS-SPECIFIC COLLECTORS
       ============================================ */

    /**
     * Main method to collect all system information for this OS.
     * @return BaseServerInfo containing all collected system information
     */
    public abstract BaseServerInfo collect();

    /**
     * Get detailed CPU information specific to the OS.
     */
    public abstract CpuInfo getCpuInfo();

    /**
     * Get detailed memory (RAM) information specific to the OS.
     */
    public abstract MemoryInfo getMemoryInfo();

    /**
     * Get disk/partition information specific to the OS.
     */
    public abstract DiskInfo getDiskInfo();

    /**
     * Get network interface information specific to the OS.
     */
    public abstract NetworkInfo getNetworkInfo();

    /**
     * Get running processes information.
     */
    public abstract List<ProcessInfo> getRunningProcesses();

    /**
     * Get running services information.
     */
    public abstract List<ServiceInfo> getRunningServices();

    /**
     * Get system load/performance metrics.
     */
    public abstract PerformanceMetrics getPerformanceMetrics();

    /**
     * Get OS-specific temperature information.
     */
    public abstract TemperatureInfo getTemperatureInfo();

    /**
     * Get OS-specific hardware details.
     */
    public abstract Object getHardwareDetails();

    /**
     * Get OS-specific server information.
     */
    public abstract ServerInfo getServerInfo();

    /**
     * Get OS-specific BIOS information.
     */
    public abstract BiosInfo getBiosInfo();

    /**
     * Get OS-specific extensions (WindowsInfo, LinuxInfo, etc.)
     */
    public abstract Object getOsSpecificInfo();

    /* ============================================
       COMMON METHODS WITH DEFAULT IMPLEMENTATIONS
       ============================================ */

    /**
     * Get common system information that works on all platforms.
     */
    public Map<String, Object> getCommonInfo() {
        Map<String, Object> common = new LinkedHashMap<>();

        try {
            // Basic JVM info
            common.put("jvm", getJvmInfo());

            // Basic system properties
            common.put("systemProperties", getBasicSystemProperties());

            // Basic CPU info (available on all JVMs)
            common.put("basicCpuInfo", getBasicCpuInfo());

            // Basic memory info (available on all JVMs)
            common.put("basicMemoryInfo", getBasicMemoryInfo());

            // User and environment info
            common.put("userInfo", getUserInfo());

            // Time and date info
            common.put("timeInfo", getTimeInfo());

            // File system roots
            common.put("fileSystemRoots", getFileSystemRoots());

        } catch (Exception e) {
            log.warn("Error collecting common info", e);
            common.put("error", e.getMessage());
        }

        return common;
    }

    /**
     * Get basic CPU information available through Java Runtime.
     */
    protected CpuInfo getBasicCpuInfo() {
        return CpuInfo.builder()
                .availableProcessors(runtime.availableProcessors())
                .architecture(System.getProperty("os.arch", "unknown"))
                .vendor(System.getProperty("java.vm.vendor", "unknown"))
                .build();
    }

    /**
     * Get basic memory information available through Java Runtime.
     */
    protected MemoryInfo getBasicMemoryInfo() {
        long totalMemory = runtime.totalMemory();
        long freeMemory = runtime.freeMemory();
        long maxMemory = runtime.maxMemory();
        long usedMemory = totalMemory - freeMemory;
        double usedPercent = maxMemory > 0 ? (usedMemory * 100.0) / maxMemory : 0.0;

        return MemoryInfo.builder()
                .totalBytes(totalMemory)
                .freeBytes(freeMemory)
//                .maxBytes(maxMemory)
                .usedBytes(usedMemory)
                .totalFormatted(formatBytes(totalMemory))
                .freeFormatted(formatBytes(freeMemory))
                .usedFormatted(formatBytes(usedMemory))
//                .maxFormatted(formatBytes(maxMemory))
                .usedPercent(String.format("%.1f", usedPercent))
                .javaTotalMemory(totalMemory)
                .javaFreeMemory(freeMemory)
                .javaMaxMemory(maxMemory)
                .javaTotalFormatted(formatBytes(totalMemory))
                .javaFreeFormatted(formatBytes(freeMemory))
                .javaMaxFormatted(formatBytes(maxMemory))
                .build();
    }

    /**
     * Parse PowerShell JSON output into a list of maps.
     */
    protected List<Map<String, Object>> parsePowerShellJson(String jsonOutput) {
        List<Map<String, Object>> result = new ArrayList<>();

        try {
            if (jsonOutput == null || jsonOutput.trim().isEmpty()) {
                return result;
            }

            // PowerShell might return JSON array or single object
            if (jsonOutput.trim().startsWith("[")) {
                result = OBJECT_MAPPER.readValue(jsonOutput,
                        OBJECT_MAPPER.getTypeFactory().constructCollectionType(List.class, Map.class));
            } else {
                Map<String, Object> singleObject = OBJECT_MAPPER.readValue(jsonOutput, Map.class);
                result.add(singleObject);
            }
        } catch (Exception e) {
            log.debug("Failed to parse PowerShell JSON output: {}", e.getMessage());
            // Return empty list instead of throwing exception
        }

        return result;
    }

    /**
     * Parse JSON array from command output.
     */
    protected List<Map<String, Object>> parseJsonArray(String jsonOutput) {
        List<Map<String, Object>> result = new ArrayList<>();

        try {
            if (jsonOutput == null || jsonOutput.trim().isEmpty()) {
                return result;
            }

            if (jsonOutput.trim().startsWith("[")) {
                result = OBJECT_MAPPER.readValue(jsonOutput,
                        OBJECT_MAPPER.getTypeFactory().constructCollectionType(List.class, Map.class));
            }
        } catch (Exception e) {
            log.debug("Failed to parse JSON array: {}", e.getMessage());
        }

        return result;
    }

    /**
     * Parse JSON object from command output.
     */
    protected Map<String, Object> parseJsonObject(String jsonOutput) {
        Map<String, Object> result = new HashMap<>();

        try {
            if (jsonOutput == null || jsonOutput.trim().isEmpty()) {
                return result;
            }

            if (jsonOutput.trim().startsWith("{")) {
                result = OBJECT_MAPPER.readValue(jsonOutput, Map.class);
            }
        } catch (Exception e) {
            log.debug("Failed to parse JSON object: {}", e.getMessage());
        }

        return result;
    }

    // ... (rest of the ServerInfoCollector class remains the same as before)

    /**
     * Get JVM information.
     */
    protected Map<String, Object> getJvmInfo() {
        Map<String, Object> jvm = new LinkedHashMap<>();

        RuntimeMXBean rb = ManagementFactory.getRuntimeMXBean();
        Properties props = System.getProperties();

        jvm.put("name", props.getProperty("java.vm.name"));
        jvm.put("version", props.getProperty("java.version"));
        jvm.put("vendor", props.getProperty("java.vendor"));
        jvm.put("home", props.getProperty("java.home"));
        jvm.put("runtime", props.getProperty("java.runtime.name"));
        jvm.put("startTime", rb.getStartTime());
        jvm.put("uptime", rb.getUptime());
        jvm.put("inputArguments", rb.getInputArguments());
        jvm.put("classPath", rb.getClassPath());
        jvm.put("libraryPath", rb.getLibraryPath());
        jvm.put("specification", getJvmSpecification());

        return jvm;
    }

    /**
     * Get JVM specification details.
     */
    protected Map<String, Object> getJvmSpecification() {
        Map<String, Object> spec = new HashMap<>();
        Properties props = System.getProperties();

        spec.put("name", props.getProperty("java.vm.specification.name"));
        spec.put("vendor", props.getProperty("java.vm.specification.vendor"));
        spec.put("version", props.getProperty("java.vm.specification.version"));

        return spec;
    }

    /**
     * Get basic system properties.
     */
    protected Map<String, Object> getBasicSystemProperties() {
        Map<String, Object> props = new HashMap<>();

        props.put("os.name", System.getProperty("os.name"));
        props.put("os.version", System.getProperty("os.version"));
        props.put("os.arch", System.getProperty("os.arch"));
        props.put("user.name", System.getProperty("user.name"));
        props.put("user.home", System.getProperty("user.home"));
        props.put("user.dir", System.getProperty("user.dir"));
        props.put("file.separator", FileSystems.getDefault().getSeparator());
        props.put("path.separator", File.pathSeparator);
        props.put("line.separator", System.lineSeparator().replace("\n", "\\n"));

        return props;
    }

    /**
     * Get user and environment information.
     */
    protected Map<String, Object> getUserInfo() {
        Map<String, Object> user = new HashMap<>();

        user.put("name", System.getProperty("user.name"));
        user.put("home", System.getProperty("user.home"));
        user.put("workingDirectory", System.getProperty("user.dir"));
        user.put("language", System.getProperty("user.language"));
        user.put("country", System.getProperty("user.country"));
        user.put("timezone", TimeZone.getDefault().getID());

        // Environment variables count
        user.put("envVarsCount", System.getenv().size());

        return user;
    }

    /**
     * Get time and date information.
     */
    protected Map<String, Object> getTimeInfo() {
        Map<String, Object> time = new HashMap<>();

        long currentTime = System.currentTimeMillis();
        time.put("currentTimeMillis", currentTime);
        time.put("currentTimeFormatted", new Date(currentTime).toString());
        time.put("nanoTime", System.nanoTime());

        // Timezone info
        TimeZone tz = TimeZone.getDefault();
        time.put("timezone", tz.getID());
        time.put("timezoneDisplay", tz.getDisplayName());
        time.put("timezoneOffset", tz.getRawOffset() / (1000 * 60 * 60) + " hours");

        return time;
    }

    /**
     * Get file system roots as POJO.
     */
    protected List<DriveInfo> getFileSystemRoots() {
        List<DriveInfo> roots = new ArrayList<>();
        File[] rootFiles = File.listRoots();

        if (rootFiles != null) {
            for (File root : rootFiles) {
                DriveInfo rootInfo = DriveInfo.builder()
                        .device(root.getAbsolutePath())
                        .mountPoint(root.getAbsolutePath())
                        .totalBytes(root.getTotalSpace())
                        .freeBytes(root.getFreeSpace())
                        .usedBytes(root.getTotalSpace() - root.getFreeSpace())
                        .totalFormatted(formatBytes(root.getTotalSpace()))
                        .freeFormatted(formatBytes(root.getFreeSpace()))
                        .usedFormatted(formatBytes(root.getTotalSpace() - root.getFreeSpace()))
                        .readOnly(!root.canWrite())
                        .build();
                roots.add(rootInfo);
            }
        }

        return roots;
    }

    /* ============================================
       UTILITY METHODS
       ============================================ */

    /**
     * Common method to execute shell commands using ProcessExecutor.
     */
    protected String exec(String... command) {
        try {
            var processor = new GenericStreamProcessor();
            var output = new StringBuilder();

            // For Windows, we need to handle PowerShell commands specially
            String[] finalCommand;
            if (command.length == 1 && command[0].contains("powershell.exe") && command[0].contains("-Command")) {
                // Split the PowerShell command properly
                // Format: powershell.exe -Command "command here"
                String cmd = command[0];
                int commandIndex = cmd.indexOf("-Command");
                String powershell = cmd.substring(0, commandIndex).trim();
                String args = cmd.substring(commandIndex).trim();

                // Split into: ["powershell.exe", "-Command", "actual command"]
                finalCommand = new String[]{
                        powershell,
                        args.substring(0, args.indexOf(' ')), // "-Command"
                        args.substring(args.indexOf(' ') + 1) // The actual command
                };
            } else if (command.length == 1 && command[0].startsWith("wmic")) {
                // For wmic commands, split by space but keep quoted strings together
                List<String> parts = new ArrayList<>();
                String cmd = command[0];
                StringBuilder current = new StringBuilder();
                boolean inQuotes = false;

                for (int i = 0; i < cmd.length(); i++) {
                    char c = cmd.charAt(i);
                    if (c == '"') {
                        inQuotes = !inQuotes;
                        current.append(c);
                    } else if (c == ' ' && !inQuotes) {
                        if (!current.isEmpty()) {
                            parts.add(current.toString());
                            current = new StringBuilder();
                        }
                    } else {
                        current.append(c);
                    }
                }
                if (current.length() > 0) {
                    parts.add(current.toString());
                }
                finalCommand = parts.toArray(new String[0]);
            } else {
                finalCommand = command;
            }

            var config = ProcessExecutor.ProcessConfiguration.builder()
                    .command(finalCommand)
                    .outputProcessor(line -> {
                        output.append(line).append("\n");
                        processor.processLine(line, false);
                    })
                    .errorProcessor(line -> {
                        log.debug("Command stderr: {}", line);
                        processor.processLine(line, true);
                    })
                    .timeout(Duration.ofSeconds(5))
                    .successPredicate(code -> code == 0 || code == 1)
                    .build();

            var result = processExecutor.execute(config);

            if (result.success() || result.exitCode() == 1) {
                return output.toString().trim();
            } else {
                log.warn("Command failed with exit code {}: {}",
                        result.exitCode(), String.join(" ", finalCommand));
                return "";
            }
        } catch (Exception e) {
            log.error("Error executing command: {}", String.join(" ", command), e);
            return "";
        }
    }

    /**
     * Execute command and return output as list of lines.
     */
    protected List<String> execLines(String... command) {
        String output = exec(command);
        if (output.isEmpty()) {
            return Collections.emptyList();
        }
        return Arrays.asList(output.split("\n"));
    }

    /**
     * Parse key-value pairs from command output (like /proc files).
     */
    protected Map<String, String> parseKeyValueOutput(String output, String delimiter) {
        Map<String, String> result = new HashMap<>();
        if (output == null || output.isEmpty()) {
            return result;
        }

        String[] lines = output.split("\n");
        for (String line : lines) {
            if (line.contains(delimiter)) {
                String[] parts = line.split(delimiter, 2);
                if (parts.length == 2) {
                    result.put(parts[0].trim(), parts[1].trim());
                }
            }
        }
        return result;
    }

    /**
     * Read file content safely.
     */
    protected String readFileSafe(Path filePath) {
        try {
            if (Files.exists(filePath) && Files.isReadable(filePath)) {
                return Files.readString(filePath).trim();
            }
        } catch (IOException e) {
            log.debug("Cannot read file {}: {}", filePath, e.getMessage());
        }
        return "";
    }

    /**
     * Parse JSON output from commands.
     */
    protected JsonNode parseJson(String json) {
        try {
            return OBJECT_MAPPER.readTree(json);
        } catch (IOException e) {
            log.debug("Failed to parse JSON: {}", e.getMessage());
            return OBJECT_MAPPER.createObjectNode();
        }
    }

    /**
     * Calculate percentage used.
     */
    protected double calculatePercentage(long used, long total) {
        if (total <= 0) return 0.0;
        return (used * 100.0) / total;
    }

    /**
     * Format bytes to human readable format.
     */
    protected String formatBytes(long bytes) {
        if (bytes <= 0) return "0 B";

        final String[] units = {"B", "KB", "MB", "GB", "TB", "PB"};
        int digitGroups = (int) (Math.log10(bytes) / Math.log10(1024));

        if (digitGroups >= units.length) {
            digitGroups = units.length - 1;
        }

        return String.format("%.2f %s", bytes / Math.pow(1024, digitGroups), units[digitGroups]);
    }

    /**
     * Get disk usage for a path.
     */
    protected DriveInfo getDiskUsageForPath(String path) {
        try {
            File file = new File(path);
            long total = file.getTotalSpace();
            long free = file.getFreeSpace();
            long used = total - free;
            double usedPercent = calculatePercentage(used, total);

            return DriveInfo.builder()
                    .device(path)
                    .mountPoint(path)
                    .totalBytes(total)
                    .freeBytes(free)
                    .usedBytes(used)
                    .totalFormatted(formatBytes(total))
                    .freeFormatted(formatBytes(free))
                    .usedFormatted(formatBytes(used))
                    .usedPercent(String.format("%.1f", usedPercent))
                    .readOnly(!file.canWrite())
                    .build();
        } catch (Exception e) {
            log.debug("Error getting disk usage for {}: {}", path, e.getMessage());
            return DriveInfo.builder().device(path).build();
        }
    }

    /**
     * Get hostname using Java's InetAddress.
     */
    protected String getHostname() {
        try {
            return InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            return "unknown";
        }
    }

    /**
     * Get IP address of the machine.
     */
    protected List<String> getIpAddresses() {
        List<String> ips = new ArrayList<>();
        try {
            Enumeration<NetworkInterface> nets = NetworkInterface.getNetworkInterfaces();
            while (nets.hasMoreElements()) {
                NetworkInterface netint = nets.nextElement();
                if (netint.isUp() && !netint.isLoopback()) {
                    Enumeration<InetAddress> inetAddresses = netint.getInetAddresses();
                    while (inetAddresses.hasMoreElements()) {
                        InetAddress inet = inetAddresses.nextElement();
                        if (!inet.isLoopbackAddress()) {
                            ips.add(inet.getHostAddress());
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Error getting IP addresses", e);
        }
        return ips;
    }

    /**
     * Calculate system health status based on various metrics.
     */
    protected HealthStatus calculateHealthStatus(BaseServerInfo systemData) {
        int score = 100;
        List<String> warnings = new ArrayList<>();
        List<String> issues = new ArrayList<>();
        List<String> recommendations = new ArrayList<>();

        try {
            // Check memory usage
            if (systemData.getMemory() != null) {
                MemoryInfo memory = systemData.getMemory();
                if (memory.getUsedPercent() != null) {
                    try {
                        double usedPercent = Double.parseDouble(memory.getUsedPercent());
                        if (usedPercent > 90) {
                            score -= 25;
                            issues.add("High memory usage: " + usedPercent + "%");
                            recommendations.add("Consider closing unused applications or adding more RAM");
                        } else if (usedPercent > 80) {
                            score -= 15;
                            warnings.add("Memory usage getting high: " + usedPercent + "%");
                        }
                    } catch (NumberFormatException e) {
                        // Ignore
                    }
                }
            }

            // Check disk space
            if (systemData.getDisk() != null && systemData.getDisk().getDrives() != null) {
                for (DriveInfo drive : systemData.getDisk().getDrives()) {
                    if (drive.getUsedPercent() != null) {
                        try {
                            double usedPercent = Double.parseDouble(drive.getUsedPercent());
                            if (usedPercent > 95) {
                                score -= 30;
                                issues.add("Critical disk space on " + drive.getMountPoint() + ": " + usedPercent + "% used");
                                recommendations.add("Free up disk space on " + drive.getMountPoint());
                            } else if (usedPercent > 90) {
                                score -= 20;
                                warnings.add("Low disk space on " + drive.getMountPoint() + ": " + usedPercent + "% used");
                            }
                        } catch (NumberFormatException e) {
                            // Ignore
                        }
                    }
                }
            }

            // Check CPU load
            if (systemData.getPerformance() != null && systemData.getPerformance().getCpuLoad1Min() != null) {
                double cpuLoad = systemData.getPerformance().getCpuLoad1Min();
                if (cpuLoad > 90) {
                    score -= 20;
                    issues.add("High CPU load: " + cpuLoad + "%");
                    recommendations.add("Identify and terminate resource-intensive processes");
                } else if (cpuLoad > 80) {
                    score -= 10;
                    warnings.add("CPU load high: " + cpuLoad + "%");
                }
            }

            // Determine health level
            HealthStatus.HealthLevel level = getHealthLevel(score);

            return HealthStatus.builder()
                    .score(Math.max(0, score))
                    .level(level)
                    .warnings(warnings)
                    .issues(issues)
                    .recommendations(recommendations)
                    .timestamp(System.currentTimeMillis())
                    .build();

        } catch (Exception e) {
            log.debug("Error calculating health status", e);
            return HealthStatus.builder()
                    .score(0)
                    .level(HealthStatus.HealthLevel.CRITICAL)
                    .issues(List.of("Error calculating health: " + e.getMessage()))
                    .timestamp(System.currentTimeMillis())
                    .build();
        }
    }

    /**
     * Convert health score to status.
     */
    private HealthStatus.HealthLevel getHealthLevel(int score) {
        if (score >= 90) return HealthStatus.HealthLevel.EXCELLENT;
        if (score >= 80) return HealthStatus.HealthLevel.GOOD;
        if (score >= 70) return HealthStatus.HealthLevel.FAIR;
        if (score >= 60) return HealthStatus.HealthLevel.POOR;
        return HealthStatus.HealthLevel.CRITICAL;
    }

    /**
     * Detect if system is Raspberry Pi.
     */
    protected boolean isRaspberryPi() {
        try {
            // Check /proc/device-tree/model for Raspberry Pi
            Path modelPath = Path.of("/proc/device-tree/model");
            if (Files.exists(modelPath)) {
                String model = readFileSafe(modelPath);
                return model.toLowerCase().contains("raspberry pi");
            }

            // Check CPU info for Raspberry Pi
            Path cpuInfoPath = Path.of("/proc/cpuinfo");
            if (Files.exists(cpuInfoPath)) {
                String cpuInfo = readFileSafe(cpuInfoPath);
                return cpuInfo.contains("Raspberry Pi") ||
                        cpuInfo.contains("BCM2835") ||
                        cpuInfo.contains("BCM2836") ||
                        cpuInfo.contains("BCM2837") ||
                        cpuInfo.contains("BCM2711") ||
                        cpuInfo.contains("BCM2712");
            }

            return false;
        } catch (Exception e) {
            log.debug("Error detecting Raspberry Pi", e);
            return false;
        }
    }

    /**
     * Detect OS type from system properties.
     */
    protected String detectOsType() {
        String osName = System.getProperty("os.name", "").toLowerCase();

        if (osName.contains("win")) {
            return "windows";
        } else if (osName.contains("mac")) {
            return "mac";
        } else if (osName.contains("nix") || osName.contains("nux") || osName.contains("aix")) {
            return "linux";
        }

        return "unknown";
    }

    /**
     * Create appropriate server info object based on OS detection.
     */
    protected BaseServerInfo createServerInfo() {
        String osType = detectOsType();
        boolean isRPi = isRaspberryPi();

        return ServerInfoFactory.create(osType, isRPi);
    }

    /**
     * Helper method for safe string value extraction.
     */
    protected String getStringValue(Object value, String defaultValue) {
        return value != null ? value.toString() : defaultValue;
    }

    /**
     * Helper method for safe integer value extraction.
     */
    protected Integer getIntegerValue(Object value) {
        if (value == null) return null;
        try {
            if (value instanceof Number) {
                return ((Number) value).intValue();
            } else {
                return Integer.parseInt(value.toString());
            }
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * Helper method for safe long value extraction.
     */
    protected Long getLongValue(Object value) {
        if (value == null) return 0L;
        try {
            if (value instanceof Number) {
                return ((Number) value).longValue();
            } else {
                return Long.parseLong(value.toString());
            }
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    /**
     * Helper method for safe double value extraction.
     */
    protected Double getDoubleValue(Object value) {
        if (value == null) return 0.0;
        try {
            if (value instanceof Number) {
                return ((Number) value).doubleValue();
            } else {
                return Double.parseDouble(value.toString());
            }
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }

    /**
     * Helper method for safe boolean value extraction.
     */
    protected Boolean getBooleanValue(Object value) {
        if (value == null) return false;
        try {
            if (value instanceof Boolean) {
                return (Boolean) value;
            } else if (value instanceof String) {
                String str = ((String) value).toLowerCase();
                return str.equals("true") || str.equals("1") || str.equals("yes") || str.equals("enabled");
            } else if (value instanceof Number) {
                return ((Number) value).intValue() != 0;
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Add Java memory information to MemoryInfo object.
     */
    protected void addJavaMemoryInfo(MemoryInfo memoryInfo) {
        Runtime runtime = Runtime.getRuntime();
        memoryInfo.setJavaTotalMemory(runtime.totalMemory());
        memoryInfo.setJavaFreeMemory(runtime.freeMemory());
        memoryInfo.setJavaMaxMemory(runtime.maxMemory());
        memoryInfo.setJavaTotalFormatted(formatBytes(runtime.totalMemory()));
        memoryInfo.setJavaFreeFormatted(formatBytes(runtime.freeMemory()));
        memoryInfo.setJavaMaxFormatted(formatBytes(runtime.maxMemory()));
    }
}