package com.db.dbworld.services.systemInfo;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.lang.management.ManagementFactory;
import java.lang.management.MemoryPoolMXBean;
import java.lang.management.RuntimeMXBean;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class SystemInfoService {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final long CACHE_TTL = 2000; // 2 seconds cache

    private final Map<String, Object> cachedData = new HashMap<>();
    private long lastUpdateTime = 0;

    // OS-specific collectors
    private final SystemCollector osCollector;

    public SystemInfoService() {
        this.osCollector = createOSCollector();
    }

    public Map<String, Object> getSystemInfo() {
        long currentTime = System.currentTimeMillis();

        if (currentTime - lastUpdateTime < CACHE_TTL && !cachedData.isEmpty()) {
            return new HashMap<>(cachedData);
        }

        Map<String, Object> result = new LinkedHashMap<>();

        try {
            // Add timestamp
            result.put("timestamp", LocalDateTime.now().format(FORMATTER));
            result.put("uptime", getSystemUptime());

            // Collect OS-specific data
            Map<String, Object> osData = osCollector.collect();
            result.putAll(osData);

            // Add common system info
            result.put("common", collectCommonInfo());
            result.put("os", getOSDetails());
            result.put("jvm", getJVMInfo());
            result.put("network", collectNetworkInfo());
            result.put("processes", getRunningProcesses());
            result.put("temperature", getTemperatureInfo());
            result.put("security", getSecurityInfo());

            // Calculate health score
            result.put("healthScore", calculateHealthScore(result));

            // Cache the result
            cachedData.clear();
            cachedData.putAll(result);
            lastUpdateTime = currentTime;

        } catch (Exception e) {
            result.put("error", "Failed to collect system info: " + e.getMessage());
            result.put("timestamp", LocalDateTime.now().format(FORMATTER));
        }

        return result;
    }

    /* =========================
       OS COLLECTOR INTERFACE & FACTORY
       ========================= */
    private interface SystemCollector {
        Map<String, Object> collect();
    }

    private SystemCollector createOSCollector() {
        String osName = System.getProperty("os.name").toLowerCase();

        if (osName.contains("linux")) {
            return new LinuxCollector();
        } else if (osName.contains("windows")) {
            return new WindowsCollector();
        } else {
            return new UnsupportedOSCollector();
        }
    }

    /* =========================
       LINUX COLLECTOR
       ========================= */
    private static class LinuxCollector implements SystemCollector {
        private final CommandExecutor executor = new CommandExecutor();

        @Override
        public Map<String, Object> collect() {
            Map<String, Object> result = new HashMap<>();

            try {
                // Try advanced collection first
                result.put("cpu", getCpuInfo());
                result.put("memory", getMemoryInfo());
//                result.put("load", getLoadInfo());
                result.put("disk", getDiskInfo());
                result.put("io", getIOStats());
                result.put("users", getLoggedUsers());
                result.put("services", getServiceStatus());
                result.put("kernel", getKernelInfo());
                result.put("packages", getPackageInfo());

            } catch (Exception e) {
                // Fallback to basic collection
                result.put("cpu", getBasicCpuInfo());
                result.put("memory", getBasicMemoryInfo());
                result.put("load", getBasicLoadInfo());
                result.put("disk", getBasicDiskInfo());
            }

            return result;
        }

        private Map<String, Object> getCpuInfo() {
            Map<String, Object> cpuInfo = new HashMap<>();

            try {
                // Get detailed CPU info from /proc/cpuinfo
                String cpuinfo = executor.execute("cat", "/proc/cpuinfo");
                String[] cpuLines = cpuinfo.split("\n");

                List<Map<String, Object>> cores = new ArrayList<>();
                Map<String, String> currentCore = new HashMap<>();

                for (String line : cpuLines) {
                    if (line.trim().isEmpty()) {
                        if (!currentCore.isEmpty()) {
                            cores.add(new HashMap<>(currentCore));
                            currentCore.clear();
                        }
                        continue;
                    }

                    String[] parts = line.split(":");
                    if (parts.length >= 2) {
                        String key = parts[0].trim().replaceAll("\\s+", "");
                        String value = parts[1].trim();
                        currentCore.put(key, value);
                    }
                }

                // Get real-time CPU usage from mpstat if available
                String mpstat = executor.execute("mpstat", "-P", "ALL", "1", "1");
                if (!mpstat.isBlank()) {
                    cpuInfo.put("realTimeStats", parseMpstat(mpstat));
                }

                // Get CPU frequency
                String freq = executor.execute("cat", "/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq");
                if (!freq.isBlank()) {
                    cpuInfo.put("currentFrequencyMHz", Integer.parseInt(freq.trim()) / 1000);
                }

                // Get CPU temperature
                String temp = executor.execute("cat", "/sys/class/thermal/thermal_zone0/temp");
                if (!temp.isBlank()) {
                    cpuInfo.put("temperatureC", Integer.parseInt(temp.trim()) / 1000.0);
                }

                cpuInfo.put("cores", cores.size());
                cpuInfo.put("coreDetails", cores);
                cpuInfo.put("architecture", System.getProperty("os.arch"));

            } catch (Exception e) {
                cpuInfo.put("error", "Failed to get CPU info: " + e.getMessage());
            }

            return cpuInfo;
        }

        private Map<String, Object> getMemoryInfo() {
            Map<String, Object> memInfo = new HashMap<>();

            try {
                String mem = executor.execute("cat", "/proc/meminfo");
                Map<String, Long> memoryMap = new HashMap<>();

                for (String line : mem.split("\n")) {
                    String[] parts = line.split(":");
                    if (parts.length >= 2) {
                        String key = parts[0].trim();
                        String value = parts[1].trim().replaceAll("[^0-9]", "");
                        if (!value.isEmpty()) {
                            memoryMap.put(key, Long.parseLong(value) * 1024);
                        }
                    }
                }

                // Calculate memory metrics
                long total = memoryMap.getOrDefault("MemTotal", 0L);
                long available = memoryMap.getOrDefault("MemAvailable", 0L);
                long cached = memoryMap.getOrDefault("Cached", 0L);
                long buffers = memoryMap.getOrDefault("Buffers", 0L);
                long swapTotal = memoryMap.getOrDefault("SwapTotal", 0L);
                long swapFree = memoryMap.getOrDefault("SwapFree", 0L);

                memInfo.put("total", total);
                memInfo.put("available", available);
                memInfo.put("used", total - available);
                memInfo.put("cached", cached);
                memInfo.put("buffers", buffers);
                memInfo.put("swapTotal", swapTotal);
                memInfo.put("swapUsed", swapTotal - swapFree);
                memInfo.put("swapFree", swapFree);

                // Get top memory-consuming processes
                String topMem = executor.execute("ps", "aux", "--sort=-%mem", "|", "head", "-11");
                memInfo.put("topMemoryProcesses", ProcessParser.parseLinuxOutput(topMem));

            } catch (Exception e) {
                memInfo.put("error", "Failed to get memory info: " + e.getMessage());
            }

            return memInfo;
        }

        private Map<String, Object> getDiskInfo() {
            List<Map<String, Object>> disks = new ArrayList<>();

            try {
                // Get detailed disk info with lsblk
                String lsblk = executor.execute("lsblk", "-o", "NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE,LABEL,UUID", "-J");
                if (!lsblk.isBlank()) {
                    disks.addAll(DiskParser.parseLsblk(lsblk));
                } else {
                    // Fallback to df
                    String df = executor.execute("df", "-B1", "-T");
                    disks.addAll(DiskParser.parseDfAdvanced(df));
                }

                // Get disk I/O stats
                String iostat = executor.execute("iostat", "-d", "-x", "1", "1");
                if (!iostat.isBlank()) {
                    Map<String, Object> ioStats = DiskParser.parseIostat(iostat);
                    disks.forEach(disk -> {
                        String name = (String) disk.get("name");
                        if (ioStats.containsKey(name)) {
                            disk.put("ioStats", ioStats.get(name));
                        }
                    });
                }

            } catch (Exception e) {
                disks.add(Map.of("error", "Failed to get disk info: " + e.getMessage()));
            }

            return Map.of("disks", disks);
        }

        private Map<String, Object> getIOStats() {
            Map<String, Object> ioStats = new HashMap<>();
            try {
                String iostat = executor.execute("iostat", "-c", "1", "1");
                if (!iostat.isBlank()) {
                    String[] lines = iostat.split("\n");
                    for (String line : lines) {
                        if (line.contains("avg-cpu")) continue;
                        String[] parts = line.trim().split("\\s+");
                        if (parts.length >= 6) {
                            ioStats.put("user", Double.parseDouble(parts[0]));
                            ioStats.put("system", Double.parseDouble(parts[2]));
                            ioStats.put("iowait", Double.parseDouble(parts[3]));
                            ioStats.put("steal", Double.parseDouble(parts[4]));
                            ioStats.put("idle", Double.parseDouble(parts[5]));
                        }
                    }
                }
            } catch (Exception e) {
                // Ignore errors
            }
            return ioStats;
        }

        private List<Map<String, Object>> getLoggedUsers() {
            List<Map<String, Object>> users = new ArrayList<>();
            try {
                String who = executor.execute("who");
                String[] lines = who.split("\n");
                for (String line : lines) {
                    if (!line.trim().isEmpty()) {
                        String[] parts = line.split("\\s+");
                        if (parts.length >= 4) {
                            users.add(Map.of(
                                    "username", parts[0],
                                    "terminal", parts[1],
                                    "loginTime", parts[2] + " " + parts[3],
                                    "remoteHost", parts.length > 4 ?
                                            parts[4].replace("(", "").replace(")", "") : "local"
                            ));
                        }
                    }
                }
            } catch (Exception e) {
                // Ignore errors
            }
            return users;
        }

        private Map<String, Object> getServiceStatus() {
            Map<String, Object> services = new HashMap<>();
            try {
                String[] serviceNames = {"nginx", "apache2", "mysql", "postgresql", "redis", "docker"};
                for (String service : serviceNames) {
                    String status = executor.execute("systemctl", "is-active", service);
                    if (!status.isBlank() && !status.contains("not found")) {
                        services.put(service, status.trim());
                    }
                }
            } catch (Exception e) {
                // Ignore errors
            }
            return services;
        }

        private Map<String, Object> getKernelInfo() {
            Map<String, Object> kernel = new HashMap<>();
            try {
                String uname = executor.execute("uname", "-a");
                String[] parts = uname.split("\\s+");
                kernel.put("kernel", parts[0]);
                kernel.put("hostname", parts[1]);
                kernel.put("kernelVersion", parts[2]);
                kernel.put("buildDate", parts[3] + " " + parts[4]);
                kernel.put("architecture", parts[parts.length - 1]);
            } catch (Exception e) {
                kernel.put("error", e.getMessage());
            }
            return kernel;
        }

        private Map<String, Object> getPackageInfo() {
            Map<String, Object> packages = new HashMap<>();
            try {
                if (Files.exists(Path.of("/usr/bin/apt"))) {
                    String apt = executor.execute("apt", "list", "--installed", "|", "wc", "-l");
                    packages.put("total", apt.trim());
                    packages.put("manager", "APT");
                } else if (Files.exists(Path.of("/usr/bin/yum"))) {
                    String yum = executor.execute("yum", "list", "installed", "|", "wc", "-l");
                    packages.put("total", yum.trim());
                    packages.put("manager", "YUM");
                } else if (Files.exists(Path.of("/usr/bin/pacman"))) {
                    String pacman = executor.execute("pacman", "-Q", "|", "wc", "-l");
                    packages.put("total", pacman.trim());
                    packages.put("manager", "Pacman");
                }
            } catch (Exception e) {
                // Ignore errors
            }
            return packages;
        }

        // Basic fallback methods
        private Map<String, Object> getBasicCpuInfo() {
            return CpuParser.parseLinuxBasic(executor);
        }

        private Map<String, Object> getBasicMemoryInfo() {
            return MemoryParser.parseLinuxBasic(executor);
        }

        private Map<String, Object> getBasicLoadInfo() {
            return LoadParser.parseLinuxBasic(executor);
        }

        private Map<String, Object> getBasicDiskInfo() {
            return DiskParser.parseLinuxBasic(executor);
        }
    }

    /* =========================
       WINDOWS COLLECTOR
       ========================= */
    private static class WindowsCollector implements SystemCollector {
        private final CommandExecutor executor = new CommandExecutor();

        @Override
        public Map<String, Object> collect() {
            Map<String, Object> result = new HashMap<>();

            try {
                String psScript = """
                    $info = @{}
                    
                    # Computer Info
                    $computerInfo = Get-ComputerInfo
                    $info.computer = @{
                        OS = $computerInfo.WindowsProductName
                        Version = $computerInfo.WindowsVersion
                        Build = $computerInfo.WindowsBuildLabEx
                        LastBoot = $computerInfo.OsLastBootUpTime
                        Uptime = (Get-Date) - $computerInfo.OsLastBootUpTime
                    }
                    
                    # CPU Info
                    $cpu = Get-WmiObject Win32_Processor
                    $info.cpu = @{
                        Name = $cpu.Name
                        Cores = $cpu.NumberOfCores
                        Threads = $cpu.NumberOfLogicalProcessors
                        MaxClock = $cpu.MaxClockSpeed
                        CurrentClock = $cpu.CurrentClockSpeed
                        Load = (Get-Counter '\\Processor(_Total)\\% Processor Time').CounterSamples.CookedValue
                    }
                    
                    # Memory Info
                    $mem = Get-WmiObject Win32_OperatingSystem
                    $info.memory = @{
                        Total = $mem.TotalVisibleMemorySize * 1024
                        Free = $mem.FreePhysicalMemory * 1024
                        Used = ($mem.TotalVisibleMemorySize - $mem.FreePhysicalMemory) * 1024
                    }
                    
                    # Disk Info
                    $disks = Get-WmiObject Win32_LogicalDisk | Where-Object {$_.DriveType -eq 3}
                    $diskArray = @()
                    foreach ($disk in $disks) {
                        $diskArray += @{
                            Name = $disk.DeviceID
                            Label = $disk.VolumeName
                            Total = $disk.Size
                            Free = $disk.FreeSpace
                            Used = $disk.Size - $disk.FreeSpace
                            FileSystem = $disk.FileSystem
                        }
                    }
                    $info.disks = $diskArray
                    
                    # Network Info
                    $network = Get-NetAdapterStatistics
                    $info.network = @{
                        Adapters = $network
                    }
                    
                    # Services
                    $services = Get-Service | Where-Object {$_.Status -eq 'Running'} | Select-Object -First 10
                    $info.services = $services
                    
                    # Processes
                    $processes = Get-Process | Sort-Object CPU -Descending | Select-Object -First 10
                    $info.processes = $processes
                    
                    # Convert to JSON
                    $info | ConvertTo-Json -Depth 10
                    """;

                String json = executor.execute("powershell", "-Command", psScript);
                result = parseJson(json);

            } catch (Exception e) {
                result.put("error", "Windows collection failed: " + e.getMessage());
            }

            return result;
        }

        private Map<String, Object> parseJson(String json) {
            try {
                return MAPPER.readValue(json, Map.class);
            } catch (Exception e) {
                return Map.of("error", "JSON parse failed: " + e.getMessage());
            }
        }
    }

    /* =========================
       UNSUPPORTED OS COLLECTOR
       ========================= */
    private static class UnsupportedOSCollector implements SystemCollector {
        @Override
        public Map<String, Object> collect() {
            return Map.of("error", "Unsupported OS");
        }
    }

    /* =========================
       COMMON INFO COLLECTION
       ========================= */
    private Map<String, Object> collectCommonInfo() {
        Map<String, Object> common = new HashMap<>();

        // Runtime info
        Runtime runtime = Runtime.getRuntime();
        common.put("availableProcessors", runtime.availableProcessors());
        common.put("freeMemory", runtime.freeMemory());
        common.put("totalMemory", runtime.totalMemory());
        common.put("maxMemory", runtime.maxMemory());
        common.put("usedMemory", runtime.totalMemory() - runtime.freeMemory());

        // System properties
        Properties props = System.getProperties();
        common.put("javaVersion", props.getProperty("java.version"));
        common.put("javaVendor", props.getProperty("java.vendor"));
        common.put("javaHome", props.getProperty("java.home"));
        common.put("userName", props.getProperty("user.name"));
        common.put("userHome", props.getProperty("user.home"));
        common.put("userDir", props.getProperty("user.dir"));

        // Environment variables (filter sensitive data)
        Map<String, String> env = new HashMap<>();
        System.getenv().forEach((key, value) -> {
            if (!key.toLowerCase().contains("password") &&
                    !key.toLowerCase().contains("secret")) {
                env.put(key, value);
            }
        });
        common.put("environment", env);

        return common;
    }

    private Map<String, Object> getOSDetails() {
        Map<String, Object> os = new HashMap<>();
        os.put("name", System.getProperty("os.name"));
        os.put("version", System.getProperty("os.version"));
        os.put("arch", System.getProperty("os.arch"));
        os.put("patchLevel", System.getProperty("sun.os.patch.level"));
        return os;
    }

    private Map<String, Object> getJVMInfo() {
        Map<String, Object> jvm = new HashMap<>();
        RuntimeMXBean runtimeMxBean = ManagementFactory.getRuntimeMXBean();

        jvm.put("name", runtimeMxBean.getVmName());
        jvm.put("vendor", runtimeMxBean.getVmVendor());
        jvm.put("version", runtimeMxBean.getVmVersion());
        jvm.put("uptime", runtimeMxBean.getUptime());
        jvm.put("startTime", runtimeMxBean.getStartTime());

        // Memory pools
        List<MemoryPoolMXBean> memoryPools = ManagementFactory.getMemoryPoolMXBeans();
        List<Map<String, Object>> pools = new ArrayList<>();
        for (MemoryPoolMXBean pool : memoryPools) {
            Map<String, Object> poolInfo = new HashMap<>();
            poolInfo.put("name", pool.getName());
            poolInfo.put("type", pool.getType().toString());

            // Get memory usage with proper handling
            java.lang.management.MemoryUsage usage = pool.getUsage();
            if (usage != null) {
                Map<String, Object> usageInfo = new HashMap<>();
                usageInfo.put("init", usage.getInit());
                usageInfo.put("used", usage.getUsed());
                usageInfo.put("committed", usage.getCommitted());
                usageInfo.put("max", usage.getMax());
                poolInfo.put("usage", usageInfo);
            }

            pools.add(poolInfo);
        }
        jvm.put("memoryPools", pools);

        return jvm;
    }

    private Map<String, Object> collectNetworkInfo() {
        Map<String, Object> network = new HashMap<>();
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            List<Map<String, Object>> ifaceList = new ArrayList<>();

            while (interfaces.hasMoreElements()) {
                NetworkInterface iface = interfaces.nextElement();
                if (iface.isUp() && !iface.isLoopback()) {
                    Map<String, Object> ifaceInfo = new HashMap<>();
                    ifaceInfo.put("name", iface.getName());
                    ifaceInfo.put("displayName", iface.getDisplayName());
                    ifaceInfo.put("mtu", iface.getMTU());
                    ifaceInfo.put("mac", bytesToHex(iface.getHardwareAddress()));

                    // IP addresses
                    List<String> ips = new ArrayList<>();
                    Enumeration<InetAddress> addresses = iface.getInetAddresses();
                    while (addresses.hasMoreElements()) {
                        InetAddress addr = addresses.nextElement();
                        ips.add(addr.getHostAddress());
                    }
                    ifaceInfo.put("addresses", ips);

                    ifaceList.add(ifaceInfo);
                }
            }
            network.put("interfaces", ifaceList);

        } catch (Exception e) {
            network.put("error", "Network info failed: " + e.getMessage());
        }

        return network;
    }

    private List<Map<String, Object>> getRunningProcesses() {
        List<Map<String, Object>> processes = new ArrayList<>();
        try {
            String os = System.getProperty("os.name").toLowerCase();

            if (os.contains("linux")) {
                String ps = exec("ps", "aux", "--sort=-%cpu", "|", "head", "-11");
                processes = ProcessParser.parseLinuxOutput(ps);
            } else if (os.contains("windows")) {
                String wmi = exec("wmic", "process", "get",
                        "ProcessId,Name,WorkingSetSize,ThreadCount", "/format:csv");
                processes = ProcessParser.parseWindowsOutput(wmi);
            }

        } catch (Exception e) {
            // Ignore errors
        }
        return processes;
    }

    private Map<String, Object> getTemperatureInfo() {
        Map<String, Object> temp = new HashMap<>();
        try {
            if (System.getProperty("os.name").toLowerCase().contains("linux")) {
                String[] sensorPaths = {
                        "/sys/class/thermal/thermal_zone0/temp",
                        "/sys/class/hwmon/hwmon0/temp1_input",
                        "/sys/devices/virtual/thermal/thermal_zone0/temp"
                };

                for (String path : sensorPaths) {
                    if (Files.exists(Path.of(path))) {
                        String value = exec("cat", path);
                        if (!value.isBlank()) {
                            double celsius = Double.parseDouble(value.trim()) / 1000.0;
                            temp.put("cpuCelsius", celsius);
                            temp.put("cpuFahrenheit", celsius * 9/5 + 32);
                            break;
                        }
                    }
                }
            }
        } catch (Exception e) {
            // Ignore errors
        }
        return temp;
    }

    private Map<String, Object> getSecurityInfo() {
        Map<String, Object> security = new HashMap<>();
        try {
            String os = System.getProperty("os.name").toLowerCase();

            if (os.contains("linux")) {
                if (Files.exists(Path.of("/usr/sbin/sestatus"))) {
                    String selinux = exec("sestatus");
                    security.put("selinux", selinux.contains("enabled"));
                }

                if (Files.exists(Path.of("/usr/sbin/aa-status"))) {
                    String apparmor = exec("aa-status");
                    security.put("apparmor", apparmor.contains("profiles are loaded"));
                }

                String firewall = exec("systemctl", "status", "firewalld");
                security.put("firewall", !firewall.contains("inactive"));

                String fail = exec("grep", "'Failed password'",
                        "/var/log/auth.log", "|", "tail", "-5");
                security.put("failedLogins", fail.split("\n").length);
            }

        } catch (Exception e) {
            // Ignore errors
        }
        return security;
    }

    private String getSystemUptime() {
        try {
            String os = System.getProperty("os.name").toLowerCase();
            if (os.contains("linux")) {
                String uptime = exec("cat", "/proc/uptime");
                String[] parts = uptime.split(" ");
                if (parts.length > 0) {
                    double seconds = Double.parseDouble(parts[0]);
                    return formatUptime(seconds);
                }
            } else if (os.contains("windows")) {
                return exec("powershell", "-Command",
                        "(Get-CimInstance Win32_OperatingSystem).LastBootUpTime");
            }
        } catch (Exception e) {
            // Ignore
        }
        return "Unknown";
    }

    /* =========================
       UTILITY CLASSES
       ========================= */
    private static class CommandExecutor {
        String execute(String... command) {
            try {
                Process p = new ProcessBuilder(command)
                        .redirectErrorStream(true)
                        .start();

                StringBuilder output = new StringBuilder();
                try (var br = new java.io.BufferedReader(
                        new java.io.InputStreamReader(p.getInputStream()))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        output.append(line).append("\n");
                    }
                }

                p.waitFor(2, java.util.concurrent.TimeUnit.SECONDS);
                return output.toString().trim();

            } catch (Exception e) {
                return "";
            }
        }
    }

    private static class ProcessParser {
        static List<Map<String, Object>> parseLinuxOutput(String output) {
            List<Map<String, Object>> processes = new ArrayList<>();
            String[] lines = output.split("\n");

            for (int i = 1; i < lines.length && i < 11; i++) {
                String[] parts = lines[i].trim().split("\\s+");
                if (parts.length >= 11) {
                    processes.add(
                            Map.ofEntries(
                                    Map.entry("user", parts[0]),
                                    Map.entry("pid", parts[1]),
                                    Map.entry("cpu", parts[2]),
                                    Map.entry("mem", parts[3]),
                                    Map.entry("vsz", parts[4]),
                                    Map.entry("rss", parts[5]),
                                    Map.entry("tty", parts[6]),
                                    Map.entry("stat", parts[7]),
                                    Map.entry("start", parts[8]),
                                    Map.entry("time", parts[9]),
                                    Map.entry("command", String.join(" ", Arrays.copyOfRange(parts, 10, parts.length)))
                            )
                    );

                }
            }
            return processes;
        }

        static List<Map<String, Object>> parseWindowsOutput(String output) {
            List<Map<String, Object>> processes = new ArrayList<>();
            String[] lines = output.split("\n");

            for (int i = 1; i < lines.length && i < 11; i++) {
                String[] parts = lines[i].split(",");
                if (parts.length >= 4) {
                    processes.add(Map.of(
                            "name", parts[1],
                            "pid", parts[2],
                            "memory", parts[3],
                            "threads", parts.length > 4 ? parts[4] : "0"
                    ));
                }
            }
            return processes;
        }
    }

    private static class DiskParser {
        static List<Map<String, Object>> parseLsblk(String lsblkJson) {
            List<Map<String, Object>> disks = new ArrayList<>();
            try {
                var root = MAPPER.readTree(lsblkJson);
                var blockdevices = root.path("blockdevices");
                if (blockdevices.isArray()) {
                    for (var device : blockdevices) {
                        if (device.has("type") &&
                                device.get("type").asText().equals("disk")) {
                            Map<String, Object> disk = new HashMap<>();
                            disk.put("name", device.path("name").asText());
                            disk.put("size", device.path("size").asText());
                            disk.put("type", device.path("type").asText());

                            if (device.has("children")) {
                                List<Map<String, Object>> partitions = new ArrayList<>();
                                for (var child : device.path("children")) {
                                    partitions.add(Map.of(
                                            "name", child.path("name").asText(),
                                            "mountpoint", child.path("mountpoint").asText(),
                                            "fstype", child.path("fstype").asText(),
                                            "size", child.path("size").asText()
                                    ));
                                }
                                disk.put("partitions", partitions);
                            }
                            disks.add(disk);
                        }
                    }
                }
            } catch (Exception e) {
                // Ignore parse errors
            }
            return disks;
        }

        static List<Map<String, Object>> parseDfAdvanced(String dfOutput) {
            List<Map<String, Object>> disks = new ArrayList<>();
            String[] lines = dfOutput.split("\n");

            for (int i = 1; i < lines.length; i++) {
                String line = lines[i].trim();
                if (!line.isEmpty()) {
                    String[] parts = line.split("\\s+");
                    if (parts.length >= 7) {
                        disks.add(Map.of(
                                "name", parts[0],
                                "filesystem", parts[1],
                                "total", Long.parseLong(parts[2]),
                                "used", Long.parseLong(parts[3]),
                                "free", Long.parseLong(parts[4]),
                                "usePercent", parts[5],
                                "mount", parts[6]
                        ));
                    }
                }
            }
            return disks;
        }

        static Map<String, Object> parseIostat(String iostat) {
            Map<String, Object> ioStats = new HashMap<>();
            try {
                String[] lines = iostat.split("\n");
                for (int i = 3; i < lines.length; i++) {
                    String line = lines[i].trim();
                    if (!line.isEmpty()) {
                        String[] parts = line.split("\\s+");
                        if (parts.length >= 14) {
                            Map<String, Object> stats = new HashMap<>();
                            stats.put("readsPerSec", Double.parseDouble(parts[2]));
                            stats.put("writesPerSec", Double.parseDouble(parts[3]));
                            stats.put("readKbPerSec", Double.parseDouble(parts[4]));
                            stats.put("writeKbPerSec", Double.parseDouble(parts[5]));
                            stats.put("await", Double.parseDouble(parts[9]));
                            stats.put("utilization", Double.parseDouble(parts[13]));
                            ioStats.put(parts[0], stats);
                        }
                    }
                }
            } catch (Exception e) {
                // Ignore errors
            }
            return ioStats;
        }

        static Map<String, Object> parseLinuxBasic(CommandExecutor executor) {
            Map<String, Object> diskInfo = new HashMap<>();
            List<Map<String, Object>> disks = new ArrayList<>();

            try {
                String df = executor.execute("df", "-B1");
                if (!df.isBlank()) {
                    String[] lines = df.split("\n");

                    for (int i = 1; i < lines.length; i++) {
                        String line = lines[i].trim();
                        if (!line.isEmpty()) {
                            String[] parts = line.split("\\s+");
                            if (parts.length >= 6) {
                                String filesystem = parts[0];
                                if (!filesystem.startsWith("tmpfs") &&
                                        !filesystem.startsWith("devtmpfs") &&
                                        !filesystem.startsWith("udev")) {

                                    disks.add(Map.of(
                                            "filesystem", filesystem,
                                            "total", Long.parseLong(parts[1]),
                                            "used", Long.parseLong(parts[2]),
                                            "free", Long.parseLong(parts[3]),
                                            "usePercent", parts[4],
                                            "mount", parts[5]
                                    ));
                                }
                            }
                        }
                    }
                }

                // Calculate totals
                long totalSpace = 0;
                long usedSpace = 0;
                long freeSpace = 0;

                for (Map<String, Object> disk : disks) {
                    totalSpace += (Long) disk.getOrDefault("total", 0L);
                    usedSpace += (Long) disk.getOrDefault("used", 0L);
                    freeSpace += (Long) disk.getOrDefault("free", 0L);
                }

                diskInfo.put("disks", disks);
                diskInfo.put("totalSpace", totalSpace);
                diskInfo.put("usedSpace", usedSpace);
                diskInfo.put("freeSpace", freeSpace);
                diskInfo.put("diskCount", disks.size());

                if (totalSpace > 0) {
                    double usedPercentage = (usedSpace * 100.0) / totalSpace;
                    diskInfo.put("usedPercentage", usedPercentage);
                }

            } catch (Exception e) {
                diskInfo.put("error", "Failed to get basic disk info: " + e.getMessage());
            }

            return diskInfo;
        }
    }

    private static class CpuParser {
        static Map<String, Object> parseLinuxBasic(CommandExecutor executor) {
            Map<String, Object> cpuInfo = new HashMap<>();

            try {
                String stat = executor.execute("cat", "/proc/stat");
                String[] lines = stat.split("\n");

                // Parse overall CPU usage
                if (lines.length > 0 && lines[0].startsWith("cpu ")) {
                    String[] parts = lines[0].split("\\s+");
                    if (parts.length >= 8) {
                        long user = Long.parseLong(parts[1]);
                        long nice = Long.parseLong(parts[2]);
                        long system = Long.parseLong(parts[3]);
                        long idle = Long.parseLong(parts[4]);
                        long iowait = Long.parseLong(parts[5]);
                        long irq = Long.parseLong(parts[6]);
                        long softirq = Long.parseLong(parts[7]);

                        long total = user + nice + system + idle + iowait + irq + softirq;
                        long nonIdle = user + nice + system + irq + softirq;

                        double usagePercentage = total > 0 ? (nonIdle * 100.0) / total : 0;

                        cpuInfo.put("totalTicks", total);
                        cpuInfo.put("idleTicks", idle);
                        cpuInfo.put("usagePercentage", usagePercentage);
                        cpuInfo.put("user", user);
                        cpuInfo.put("system", system);
                        cpuInfo.put("idle", idle);
                        cpuInfo.put("iowait", iowait);
                    }
                }

                // Count CPU cores
                int coreCount = 0;
                for (String line : lines) {
                    if (line.startsWith("cpu") && !line.startsWith("cpu ")) {
                        coreCount++;
                    }
                }
                cpuInfo.put("cores", coreCount);

                // Get CPU model info
                String cpuinfo = executor.execute("cat", "/proc/cpuinfo");
                String[] cpuLines = cpuinfo.split("\n");

                String modelName = "Unknown";
                String vendor = "Unknown";
                long cacheSize = 0;

                for (String line : cpuLines) {
                    if (line.contains("model name")) {
                        modelName = line.split(":")[1].trim();
                    } else if (line.contains("vendor_id")) {
                        vendor = line.split(":")[1].trim();
                    } else if (line.contains("cache size")) {
                        String cacheStr = line.split(":")[1].trim();
                        cacheSize = Long.parseLong(cacheStr.replaceAll("[^0-9]", ""));
                    }
                }

                cpuInfo.put("model", modelName);
                cpuInfo.put("vendor", vendor);
                cpuInfo.put("cacheSizeKB", cacheSize);

            } catch (Exception e) {
                cpuInfo.put("error", "Failed to get basic CPU info: " + e.getMessage());
                cpuInfo.put("cores", Runtime.getRuntime().availableProcessors());
            }

            return cpuInfo;
        }
    }

    private static class MemoryParser {
        static Map<String, Object> parseLinuxBasic(CommandExecutor executor) {
            Map<String, Object> memInfo = new HashMap<>();

            try {
                String mem = executor.execute("cat", "/proc/meminfo");
                Map<String, Long> map = new HashMap<>();

                for (String line : mem.split("\n")) {
                    if (line.contains(":")) {
                        String[] parts = line.split(":");
                        if (parts.length >= 2) {
                            String key = parts[0].trim();
                            String value = parts[1].trim().replaceAll("[^0-9]", "");
                            if (!value.isEmpty()) {
                                map.put(key, Long.parseLong(value) * 1024);
                            }
                        }
                    }
                }

                long total = map.getOrDefault("MemTotal", 0L);
                long free = map.getOrDefault("MemFree", 0L);
                long available = map.getOrDefault("MemAvailable", 0L);
                long buffers = map.getOrDefault("Buffers", 0L);
                long cached = map.getOrDefault("Cached", 0L);
                long swapTotal = map.getOrDefault("SwapTotal", 0L);
                long swapFree = map.getOrDefault("SwapFree", 0L);

                long usedReal = total - available;

                memInfo.put("total", total);
                memInfo.put("free", free);
                memInfo.put("available", available);
                memInfo.put("used", usedReal);
                memInfo.put("buffers", buffers);
                memInfo.put("cached", cached);
                memInfo.put("swapTotal", swapTotal);
                memInfo.put("swapFree", swapFree);
                memInfo.put("swapUsed", swapTotal - swapFree);

                if (total > 0) {
                    memInfo.put("usedPercentage", (usedReal * 100.0) / total);
                    memInfo.put("freePercentage", (free * 100.0) / total);
                    memInfo.put("availablePercentage", (available * 100.0) / total);
                }

            } catch (Exception e) {
                memInfo.put("error", "Failed to get basic memory info: " + e.getMessage());

                Runtime runtime = Runtime.getRuntime();
                memInfo.put("total", runtime.totalMemory());
                memInfo.put("free", runtime.freeMemory());
                memInfo.put("used", runtime.totalMemory() - runtime.freeMemory());
                memInfo.put("max", runtime.maxMemory());
            }

            return memInfo;
        }
    }

    private static class LoadParser {
        static Map<String, Object> parseLinuxBasic(CommandExecutor executor) {
            Map<String, Object> loadInfo = new HashMap<>();

            try {
                String load = executor.execute("cat", "/proc/loadavg");
                if (!load.isBlank()) {
                    String[] parts = load.split("\\s+");
                    if (parts.length >= 3) {
                        loadInfo.put("1min", Double.parseDouble(parts[0]));
                        loadInfo.put("5min", Double.parseDouble(parts[1]));
                        loadInfo.put("15min", Double.parseDouble(parts[2]));
                    }
                }

                String uptime = executor.execute("cat", "/proc/uptime");
                if (!uptime.isBlank()) {
                    String[] parts = uptime.split("\\s+");
                    if (parts.length >= 1) {
                        double seconds = Double.parseDouble(parts[0]);
                        loadInfo.put("uptimeSeconds", seconds);
                        loadInfo.put("uptimeFormatted", formatUptime(seconds));
                    }
                }

            } catch (Exception e) {
                loadInfo.put("error", "Failed to get basic load info: " + e.getMessage());
                loadInfo.put("1min", 0.0);
                loadInfo.put("5min", 0.0);
                loadInfo.put("15min", 0.0);
            }

            return loadInfo;
        }
    }

    /* =========================
       UTILITY METHODS
       ========================= */
    private static Map<String, Object> parseMpstat(String mpstat) {
        Map<String, Object> stats = new HashMap<>();
        try {
            String[] lines = mpstat.split("\n");
            for (String line : lines) {
                if (line.startsWith("Average:")) {
                    String[] parts = line.split("\\s+");
                    if (parts.length >= 13) {
                        stats.put("user", Double.parseDouble(parts[2]));
                        stats.put("nice", Double.parseDouble(parts[3]));
                        stats.put("system", Double.parseDouble(parts[4]));
                        stats.put("iowait", Double.parseDouble(parts[5]));
                        stats.put("irq", Double.parseDouble(parts[6]));
                        stats.put("soft", Double.parseDouble(parts[7]));
                        stats.put("steal", Double.parseDouble(parts[8]));
                        stats.put("guest", Double.parseDouble(parts[9]));
                        stats.put("gnice", Double.parseDouble(parts[10]));
                        stats.put("idle", Double.parseDouble(parts[11]));
                    }
                }
            }
        } catch (Exception e) {
            // Ignore errors
        }
        return stats;
    }

    private String exec(String... command) {
        return new CommandExecutor().execute(command);
    }

    private static String formatUptime(double seconds) {
        long days = (long) (seconds / (24 * 3600));
        long hours = (long) ((seconds % (24 * 3600)) / 3600);
        long minutes = (long) ((seconds % 3600) / 60);
        long secs = (long) (seconds % 60);

        return String.format("%d days, %02d:%02d:%02d", days, hours, minutes, secs);
    }

    private String bytesToHex(byte[] bytes) {
        if (bytes == null) return "";
        StringBuilder hex = new StringBuilder();
        for (byte b : bytes) {
            hex.append(String.format("%02X:", b));
        }
        return !hex.isEmpty() ? hex.substring(0, hex.length() - 1) : "";
    }

    private int calculateHealthScore(Map<String, Object> systemInfo) {
        int score = 100;

        try {
            // Check CPU load
            Object cpuObj = systemInfo.get("cpu");
            if (cpuObj instanceof Map) {
                Map<?, ?> cpu = (Map<?, ?>) cpuObj;
                if (cpu.containsKey("realTimeStats")) {
                    Map<?, ?> stats = (Map<?, ?>) cpu.get("realTimeStats");
                    Object idleObj = stats.get("idle");
                    if (idleObj instanceof Number) {
                        double idle = ((Number) idleObj).doubleValue();
                        if (idle < 10) score -= 20;
                        else if (idle < 30) score -= 10;
                    }
                }
            }

            // Check memory usage
            Object memObj = systemInfo.get("memory");
            if (memObj instanceof Map<?, ?>) {
                @SuppressWarnings("unchecked")
                Map<String, Object> mem = (Map<String, Object>) memObj;

                long total = ((Number) mem.getOrDefault("total", 0)).longValue();
                long used  = ((Number) mem.getOrDefault("used", 0)).longValue();

                if (total > 0) {
                    double usage = (used * 100.0) / total;
                    if (usage > 90) score -= 30;
                    else if (usage > 75) score -= 15;
                }
            }

            // Check disk space
            Object diskObj = systemInfo.get("disk");
            if (diskObj instanceof Map) {
                Map<?, ?> disk = (Map<?, ?>) diskObj;
                Object disksObj = disk.get("disks");
                if (disksObj instanceof List) {
                    List<?> disks = (List<?>) disksObj;
                    for (Object d : disks) {
                        if (d instanceof Map) {
                            Map<?, ?> diskMap = (Map<?, ?>) d;
                            Object usePercentObj = diskMap.get("usePercent");
                            if (usePercentObj != null) {
                                String usePercent = usePercentObj.toString().replace("%", "");
                                try {
                                    double usage = Double.parseDouble(usePercent);
                                    if (usage > 90) score -= 20;
                                    else if (usage > 75) score -= 10;
                                } catch (NumberFormatException e) {
                                    // Ignore parse errors
                                }
                            }
                        }
                    }
                }
            }

            score = Math.max(0, Math.min(100, score));

        } catch (Exception e) {
            score = 80;
        }

        return score;
    }
}