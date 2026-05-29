package com.db.dbworld.app.system.info.collector;

import com.db.dbworld.core.processor.GenericStreamProcessor;
import com.db.dbworld.core.processor.ProcessExecutor;
import com.db.dbworld.app.system.info.dto.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
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
 * Migrated from com.db.dbworld.services.server.ServerInfoCollector.
 *
 * Each OS-specific collector extends this class and implements the abstract methods.
 */
@Log4j2
public abstract class ServerInfoCollector {

    protected static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    protected final ProcessExecutor processExecutor;
    protected final Runtime runtime = Runtime.getRuntime();

    protected ServerInfoCollector(ProcessExecutor processExecutor) {
        this.processExecutor = processExecutor;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Abstract methods — implemented per OS
    // ──────────────────────────────────────────────────────────────────────────

    public abstract BaseServerInfo collect();
    public abstract CpuInfo getCpuInfo();
    public abstract MemoryInfo getMemoryInfo();
    public abstract DiskInfo getDiskInfo();
    public abstract NetworkInfo getNetworkInfo();
    public abstract List<ProcessInfo> getRunningProcesses();
    public abstract List<ServiceInfo> getRunningServices();
    public abstract PerformanceMetrics getPerformanceMetrics();
    public abstract TemperatureInfo getTemperatureInfo();
    public abstract Object getHardwareDetails();
    public abstract ServerInfo getServerInfo();
    public abstract BiosInfo getBiosInfo();
    public abstract Object getOsSpecificInfo();

    // ──────────────────────────────────────────────────────────────────────────
    // Common / cross-platform helpers
    // ──────────────────────────────────────────────────────────────────────────

    public Map<String, Object> getCommonInfo() {
        Map<String, Object> common = new LinkedHashMap<>();
        try {
            common.put("jvm",              getJvmInfo());
            common.put("systemProperties", getBasicSystemProperties());
            common.put("basicCpuInfo",     getBasicCpuInfo());
            common.put("basicMemoryInfo",  getBasicMemoryInfo());
            common.put("userInfo",         getUserInfo());
            common.put("timeInfo",         getTimeInfo());
            common.put("fileSystemRoots",  getFileSystemRoots());
        } catch (Exception e) {
            log.warn("Error collecting common info", e);
            common.put("error", e.getMessage());
        }
        return common;
    }

    public CpuInfo getBasicCpuInfo() {
        return CpuInfo.builder()
                .availableProcessors(runtime.availableProcessors())
                .architecture(System.getProperty("os.arch", "unknown"))
                .vendor(System.getProperty("java.vm.vendor", "unknown"))
                .build();
    }

    public MemoryInfo getBasicMemoryInfo() {
        long total  = runtime.totalMemory();
        long free   = runtime.freeMemory();
        long max    = runtime.maxMemory();
        long used   = total - free;
        double pct  = max > 0 ? (used * 100.0) / max : 0.0;

        return MemoryInfo.builder()
                .totalBytes(total).freeBytes(free).usedBytes(used)
                .totalFormatted(formatBytes(total)).freeFormatted(formatBytes(free)).usedFormatted(formatBytes(used))
                .usedPercent(String.format("%.1f", pct))
                .javaTotalMemory(total).javaFreeMemory(free).javaMaxMemory(max)
                .javaTotalFormatted(formatBytes(total)).javaFreeFormatted(formatBytes(free)).javaMaxFormatted(formatBytes(max))
                .build();
    }

    protected Map<String, Object> getJvmInfo() {
        Map<String, Object> jvm = new LinkedHashMap<>();
        RuntimeMXBean rb = ManagementFactory.getRuntimeMXBean();
        Properties props = System.getProperties();
        jvm.put("name",            props.getProperty("java.vm.name"));
        jvm.put("version",         props.getProperty("java.version"));
        jvm.put("vendor",          props.getProperty("java.vendor"));
        jvm.put("home",            props.getProperty("java.home"));
        jvm.put("runtime",         props.getProperty("java.runtime.name"));
        jvm.put("startTime",       rb.getStartTime());
        jvm.put("uptime",          rb.getUptime());
        jvm.put("inputArguments",  rb.getInputArguments());
        jvm.put("specification",   Map.of(
                "name",    props.getProperty("java.vm.specification.name"),
                "vendor",  props.getProperty("java.vm.specification.vendor"),
                "version", props.getProperty("java.vm.specification.version")));
        return jvm;
    }

    protected Map<String, Object> getBasicSystemProperties() {
        Map<String, Object> props = new HashMap<>();
        props.put("os.name",         System.getProperty("os.name"));
        props.put("os.version",      System.getProperty("os.version"));
        props.put("os.arch",         System.getProperty("os.arch"));
        props.put("user.name",       System.getProperty("user.name"));
        props.put("user.home",       System.getProperty("user.home"));
        props.put("user.dir",        System.getProperty("user.dir"));
        props.put("file.separator",  FileSystems.getDefault().getSeparator());
        props.put("path.separator",  File.pathSeparator);
        return props;
    }

    protected Map<String, Object> getUserInfo() {
        Map<String, Object> user = new HashMap<>();
        user.put("name",             System.getProperty("user.name"));
        user.put("home",             System.getProperty("user.home"));
        user.put("workingDirectory", System.getProperty("user.dir"));
        user.put("language",         System.getProperty("user.language"));
        user.put("country",          System.getProperty("user.country"));
        user.put("timezone",         TimeZone.getDefault().getID());
        user.put("envVarsCount",     System.getenv().size());
        return user;
    }

    protected Map<String, Object> getTimeInfo() {
        Map<String, Object> time = new HashMap<>();
        long now = System.currentTimeMillis();
        TimeZone tz = TimeZone.getDefault();
        time.put("currentTimeMillis",   now);
        time.put("currentTimeFormatted", new Date(now).toString());
        time.put("timezone",            tz.getID());
        time.put("timezoneDisplay",     tz.getDisplayName());
        time.put("timezoneOffset",      tz.getRawOffset() / (1000 * 60 * 60) + " hours");
        return time;
    }

    protected List<DriveInfo> getFileSystemRoots() {
        List<DriveInfo> roots = new ArrayList<>();
        File[] rootFiles = File.listRoots();
        if (rootFiles != null) {
            for (File root : rootFiles) {
                roots.add(DriveInfo.builder()
                        .device(root.getAbsolutePath())
                        .mountPoint(root.getAbsolutePath())
                        .totalBytes(root.getTotalSpace())
                        .freeBytes(root.getFreeSpace())
                        .usedBytes(root.getTotalSpace() - root.getFreeSpace())
                        .totalFormatted(formatBytes(root.getTotalSpace()))
                        .freeFormatted(formatBytes(root.getFreeSpace()))
                        .usedFormatted(formatBytes(root.getTotalSpace() - root.getFreeSpace()))
                        .readOnly(!root.canWrite())
                        .build());
            }
        }
        return roots;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Command execution
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Execute a system command and return stdout as a trimmed string.
     * Timeout: 10 seconds. Returns empty string on failure.
     */
    protected String exec(String... command) {
        return exec(10, command);
    }

    protected String exec(int timeoutSeconds, String... command) {
        try {
            var processor = new GenericStreamProcessor();
            var output    = new StringBuilder();

            String[] finalCommand = resolveCommand(command);

            var config = ProcessExecutor.ProcessConfiguration.builder()
                    .command(finalCommand)
                    .outputProcessor(line -> { output.append(line).append("\n"); processor.processLine(line, false); })
                    .errorProcessor(line -> log.debug("stderr: {}", line))
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .successPredicate(code -> code == 0 || code == 1)
                    .build();

            var result = processExecutor.execute(config);
            if (result.success() || result.exitCode() == 1) return output.toString().trim();

            log.warn("Command exited {}: {}", result.exitCode(), String.join(" ", finalCommand));
            return "";
        } catch (Exception e) {
            log.debug("Command error ({}): {}", String.join(" ", command), e.getMessage());
            return "";
        }
    }

    private String[] resolveCommand(String[] command) {
        // Single-string PowerShell: "powershell.exe -Command ..."
        if (command.length == 1 && command[0].contains("powershell.exe") && command[0].contains("-Command")) {
            String cmd = command[0];
            int idx    = cmd.indexOf("-Command");
            String ps  = cmd.substring(0, idx).trim();
            String rest = cmd.substring(idx).trim();
            return new String[]{ ps, rest.substring(0, rest.indexOf(' ')), rest.substring(rest.indexOf(' ') + 1) };
        }
        // Single-string wmic
        if (command.length == 1 && command[0].startsWith("wmic")) {
            return command[0].split("\\s+");
        }
        return command;
    }

    protected List<String> execLines(String... command) {
        String out = exec(command);
        return out.isEmpty() ? Collections.emptyList() : Arrays.asList(out.split("\n"));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Parsing helpers
    // ──────────────────────────────────────────────────────────────────────────

    protected List<Map<String, Object>> parsePowerShellJson(String json) {
        try {
            if (json == null || json.isBlank()) return List.of();
            if (json.trim().startsWith("[")) {
                return OBJECT_MAPPER.readValue(json,
                        OBJECT_MAPPER.getTypeFactory().constructCollectionType(List.class, Map.class));
            }
            return List.of(OBJECT_MAPPER.readValue(json, Map.class));
        } catch (Exception e) {
            log.debug("parsePowerShellJson failed: {}", e.getMessage());
            return List.of();
        }
    }

    protected List<Map<String, Object>> parseJsonArray(String json) {
        try {
            if (json != null && json.trim().startsWith("[")) {
                return OBJECT_MAPPER.readValue(json,
                        OBJECT_MAPPER.getTypeFactory().constructCollectionType(List.class, Map.class));
            }
        } catch (Exception e) {
            log.debug("parseJsonArray failed: {}", e.getMessage());
        }
        return List.of();
    }

    protected Map<String, Object> parseJsonObject(String json) {
        try {
            if (json != null && json.trim().startsWith("{")) {
                return OBJECT_MAPPER.readValue(json, Map.class);
            }
        } catch (Exception e) {
            log.debug("parseJsonObject failed: {}", e.getMessage());
        }
        return Map.of();
    }

    protected JsonNode parseJson(String json) {
        // Jackson 3's JacksonException no longer extends IOException — explicit catch.
        try {
            return OBJECT_MAPPER.readTree(json);
        } catch (tools.jackson.core.JacksonException e) {
            return OBJECT_MAPPER.createObjectNode();
        }
    }

    protected Map<String, String> parseKeyValueOutput(String output, String delimiter) {
        Map<String, String> result = new HashMap<>();
        if (output == null || output.isEmpty()) return result;
        for (String line : output.split("\n")) {
            if (line.contains(delimiter)) {
                String[] parts = line.split(delimiter, 2);
                if (parts.length == 2) result.put(parts[0].trim(), parts[1].trim());
            }
        }
        return result;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // File helpers
    // ──────────────────────────────────────────────────────────────────────────

    protected String readFileSafe(Path path) {
        try {
            if (Files.exists(path) && Files.isReadable(path)) return Files.readString(path).trim();
        } catch (IOException e) {
            log.debug("Cannot read {}: {}", path, e.getMessage());
        }
        return "";
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Maths & formatting
    // ──────────────────────────────────────────────────────────────────────────

    protected double calculatePercentage(long used, long total) {
        return total <= 0 ? 0.0 : (used * 100.0) / total;
    }

    protected String formatBytes(long bytes) {
        if (bytes <= 0) return "0 B";
        final String[] units = {"B", "KB", "MB", "GB", "TB", "PB"};
        int g = Math.min((int) (Math.log10(bytes) / Math.log10(1024)), units.length - 1);
        return String.format("%.2f %s", bytes / Math.pow(1024, g), units[g]);
    }

    protected DriveInfo getDiskUsageForPath(String path) {
        try {
            File f = new File(path);
            long total = f.getTotalSpace(), free = f.getFreeSpace(), used = total - free;
            return DriveInfo.builder()
                    .device(path).mountPoint(path)
                    .totalBytes(total).freeBytes(free).usedBytes(used)
                    .totalFormatted(formatBytes(total)).freeFormatted(formatBytes(free)).usedFormatted(formatBytes(used))
                    .usedPercent(String.format("%.1f", calculatePercentage(used, total)))
                    .readOnly(!f.canWrite())
                    .build();
        } catch (Exception e) {
            return DriveInfo.builder().device(path).build();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Network helpers
    // ──────────────────────────────────────────────────────────────────────────

    public String getHostname() {
        try { return InetAddress.getLocalHost().getHostName(); } catch (Exception e) { return "unknown"; }
    }

    protected List<String> getIpAddresses() {
        List<String> ips = new ArrayList<>();
        try {
            Enumeration<NetworkInterface> nets = NetworkInterface.getNetworkInterfaces();
            while (nets.hasMoreElements()) {
                NetworkInterface ni = nets.nextElement();
                if (ni.isUp() && !ni.isLoopback()) {
                    Enumeration<InetAddress> addrs = ni.getInetAddresses();
                    while (addrs.hasMoreElements()) {
                        InetAddress addr = addrs.nextElement();
                        if (!addr.isLoopbackAddress()) ips.add(addr.getHostAddress());
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Error getting IPs", e);
        }
        return ips;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Health
    // ──────────────────────────────────────────────────────────────────────────

    public HealthStatus calculateHealthStatus(BaseServerInfo data) {
        int score = 100;
        List<String> warnings = new ArrayList<>(), issues = new ArrayList<>(), recs = new ArrayList<>();

        try {
            if (data.getMemory() != null && data.getMemory().getUsedPercent() != null) {
                double pct = Double.parseDouble(data.getMemory().getUsedPercent());
                if (pct > 90) { score -= 25; issues.add("High memory usage: " + pct + "%"); recs.add("Add more RAM or close unused apps"); }
                else if (pct > 80) { score -= 15; warnings.add("Memory usage high: " + pct + "%"); }
            }
            if (data.getDisk() != null && data.getDisk().getDrives() != null) {
                for (DriveInfo d : data.getDisk().getDrives()) {
                    if (d.getUsedPercent() == null) continue;
                    double pct = Double.parseDouble(d.getUsedPercent());
                    if (pct > 95) { score -= 30; issues.add("Critical disk on " + d.getMountPoint() + ": " + pct + "%"); recs.add("Free disk space on " + d.getMountPoint()); }
                    else if (pct > 90) { score -= 20; warnings.add("Low disk on " + d.getMountPoint() + ": " + pct + "%"); }
                }
            }
            if (data.getPerformance() != null && data.getPerformance().getCpuLoad1Min() != null) {
                double load = data.getPerformance().getCpuLoad1Min();
                if (load > 90) { score -= 20; issues.add("High CPU load: " + load + "%"); recs.add("Identify resource-intensive processes"); }
                else if (load > 80) { score -= 10; warnings.add("CPU load high: " + load + "%"); }
            }
        } catch (Exception e) {
            log.debug("Error calculating health", e);
        }

        return HealthStatus.builder()
                .score(Math.max(0, score))
                .level(getHealthLevel(score))
                .warnings(warnings).issues(issues).recommendations(recs)
                .timestamp(System.currentTimeMillis())
                .build();
    }

    private HealthStatus.HealthLevel getHealthLevel(int score) {
        if (score >= 90) return HealthStatus.HealthLevel.EXCELLENT;
        if (score >= 80) return HealthStatus.HealthLevel.GOOD;
        if (score >= 70) return HealthStatus.HealthLevel.FAIR;
        if (score >= 60) return HealthStatus.HealthLevel.POOR;
        return HealthStatus.HealthLevel.CRITICAL;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // OS detection
    // ──────────────────────────────────────────────────────────────────────────

    protected boolean isRaspberryPi() {
        try {
            Path model = Path.of("/proc/device-tree/model");
            if (Files.exists(model) && readFileSafe(model).toLowerCase().contains("raspberry pi")) return true;
            Path cpuinfo = Path.of("/proc/cpuinfo");
            if (Files.exists(cpuinfo)) {
                String info = readFileSafe(cpuinfo);
                return info.contains("Raspberry Pi") || info.contains("BCM2835") ||
                       info.contains("BCM2836") || info.contains("BCM2837") ||
                       info.contains("BCM2711") || info.contains("BCM2712");
            }
        } catch (Exception e) { log.debug("RPi detection error", e); }
        return false;
    }

    protected String detectOsType() {
        String os = System.getProperty("os.name", "").toLowerCase();
        if (os.contains("win"))                                      return "windows";
        if (os.contains("mac"))                                      return "mac";
        if (os.contains("nix") || os.contains("nux") || os.contains("aix")) return "linux";
        return "unknown";
    }

    protected BaseServerInfo createServerInfo() {
        return ServerInfoFactory.create(detectOsType(), isRaspberryPi());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Type-safe value extractors
    // ──────────────────────────────────────────────────────────────────────────

    protected String  getStringValue(Object v, String def) { return v != null ? v.toString() : def; }
    protected Integer getIntegerValue(Object v) {
        if (v == null) return null;
        try { return v instanceof Number n ? n.intValue() : Integer.parseInt(v.toString()); }
        catch (NumberFormatException e) { return null; }
    }
    protected Long getLongValue(Object v) {
        if (v == null) return 0L;
        try { return v instanceof Number n ? n.longValue() : Long.parseLong(v.toString()); }
        catch (NumberFormatException e) { return 0L; }
    }
    protected Double getDoubleValue(Object v) {
        if (v == null) return 0.0;
        try { return v instanceof Number n ? n.doubleValue() : Double.parseDouble(v.toString()); }
        catch (NumberFormatException e) { return 0.0; }
    }
    protected Boolean getBooleanValue(Object v) {
        if (v == null) return false;
        if (v instanceof Boolean b) return b;
        if (v instanceof Number n) return n.intValue() != 0;
        if (v instanceof String s) return s.equalsIgnoreCase("true") || s.equals("1") || s.equalsIgnoreCase("yes");
        return false;
    }

    protected void addJavaMemoryInfo(MemoryInfo m) {
        Runtime rt = Runtime.getRuntime();
        m.setJavaTotalMemory(rt.totalMemory());  m.setJavaTotalFormatted(formatBytes(rt.totalMemory()));
        m.setJavaFreeMemory(rt.freeMemory());    m.setJavaFreeFormatted(formatBytes(rt.freeMemory()));
        m.setJavaMaxMemory(rt.maxMemory());      m.setJavaMaxFormatted(formatBytes(rt.maxMemory()));
    }
}
