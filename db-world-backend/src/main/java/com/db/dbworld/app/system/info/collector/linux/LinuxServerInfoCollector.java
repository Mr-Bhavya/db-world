package com.db.dbworld.app.system.info.collector.linux;

import com.db.dbworld.app.system.info.collector.ServerInfoCollector;
import com.db.dbworld.core.processor.ProcessExecutor;
import com.db.dbworld.app.system.info.dto.*;
import com.db.dbworld.app.system.info.dto.os.linux.*;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Comprehensive Linux system information collector for Ubuntu/Debian-based systems.
 * Reads /proc and /sys filesystems for zero-dependency metrics, then supplements with
 * system commands (lsblk, lsusb, lspci, ss, dpkg, dmidecode, sensors) where available.
 *
 * Features:
 * - RAM/Swap breakdown from /proc/meminfo
 * - Real-time CPU usage (delta over /proc/stat)
 * - Per-core CPU load
 * - Temperature from /sys/class/thermal and /sys/class/hwmon
 * - Fan speed from /sys/class/hwmon
 * - Live network Rx/Tx bytes/sec (delta over /proc/net/dev)
 * - Block devices and external storage (lsblk -J)
 * - USB & PCI connected devices
 * - Running processes with per-user breakdown
 * - Systemd services
 * - Installed packages (dpkg/apt)
 * - BIOS/firmware info (/sys/class/dmi/id or dmidecode)
 * - Network connections (ss -tunap)
 */
@Log4j2
@Service("linuxServerInfoCollector")
public class LinuxServerInfoCollector extends ServerInfoCollector {

    // /proc paths
    protected static final Path PROC_MEMINFO   = Path.of("/proc/meminfo");
    protected static final Path PROC_STAT      = Path.of("/proc/stat");
    protected static final Path PROC_CPUINFO   = Path.of("/proc/cpuinfo");
    protected static final Path PROC_VERSION   = Path.of("/proc/version");
    protected static final Path PROC_NET_DEV   = Path.of("/proc/net/dev");
    protected static final Path PROC_UPTIME    = Path.of("/proc/uptime");
    protected static final Path PROC_LOADAVG   = Path.of("/proc/loadavg");
    protected static final Path PROC_NET_TCP   = Path.of("/proc/net/tcp");

    // /sys paths
    protected static final Path SYS_THERMAL    = Path.of("/sys/class/thermal");
    protected static final Path SYS_HWMON      = Path.of("/sys/class/hwmon");
    protected static final Path SYS_DMI        = Path.of("/sys/class/dmi/id");
    protected static final Path SYS_BLOCK       = Path.of("/sys/class/block");

    // Cached net stats for zero-sleep delta speed in getPerformanceMetrics()
    private final AtomicReference<Map<String, long[]>> prevNetStats = new AtomicReference<>(Map.of());
    private volatile long prevNetTimestamp = 0L;

    public LinuxServerInfoCollector(ProcessExecutor processExecutor) {
        super(processExecutor);
        log.info("{} initialized", getClass().getSimpleName());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Main collect
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public BaseServerInfo collect() {
        log.info("Collecting Linux system information");
        BaseServerInfo info = createLinuxInfo();
        try {
            info.setServerInfo(getServerInfo());
            info.setBiosInfo(getBiosInfo());
            info.setCpu(getCpuInfo());
            info.setMemory(getMemoryInfo());
            info.setDisk(getDiskInfo());
            info.setNetwork(getNetworkInfo());
            info.setProcesses(getRunningProcesses());
            info.setServices(getRunningServices());
            info.setPerformance(getPerformanceMetrics());
            info.setTemperature(getTemperatureInfo());
            info.setHealthStatus(calculateHealthStatus(info));

            if (info instanceof LinuxServerInfo linuxInfo) {
                Map<String, String> distro = getDistributionInfo();
                linuxInfo.setLinuxInfo(LinuxInfo.builder()
                        .distribution(distro.getOrDefault("NAME", distro.getOrDefault("ID", "")))
                        .distributionVersion(distro.getOrDefault("VERSION_ID", distro.getOrDefault("VERSION", "")))
                        .kernelVersion(exec("uname", "-r").trim())
                        .packageManager(distro.getOrDefault("ID_LIKE", distro.getOrDefault("ID", "")).contains("debian") ? "apt" : "unknown")
                        .build());
            }
        } catch (Exception e) {
            log.error("Error during Linux info collection", e);
            info.setError("Partial collection error: " + e.getMessage());
        }
        return info;
    }

    protected BaseServerInfo createLinuxInfo() {
        LinuxServerInfo info = new LinuxServerInfo();
        info.setLinux(true);
        return info;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Server / OS info
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public ServerInfo getServerInfo() {
        String osRelease = exec("cat", "/etc/os-release");
        Map<String, String> osMap = parseKeyValueOutput(osRelease, "=");
        String prettyName = osMap.getOrDefault("PRETTY_NAME", "").replace("\"", "");
        String version    = readFileSafe(PROC_VERSION);

        return ServerInfo.builder()
                .hostname(getHostname())
                .osName(prettyName.isEmpty() ? System.getProperty("os.name") : prettyName)
                .osVersion(osMap.getOrDefault("VERSION_ID", "").replace("\"", ""))
                .osArchitecture(System.getProperty("os.arch"))
                .kernelVersion(version.contains(" ") ? version.split(" ")[2] : version)
                .manufacturer(readDmiSafe("sys_vendor"))
                .model(readDmiSafe("product_name"))
                .ipAddresses(getIpAddresses())
                .build();
    }

    @Override
    public BiosInfo getBiosInfo() {
        // Try /sys/class/dmi/id first (no root needed), fallback dmidecode
        String vendor  = readDmiSafe("bios_vendor");
        String version = readDmiSafe("bios_version");
        String date    = readDmiSafe("bios_date");
        String board   = readDmiSafe("board_name");
        String boardV  = readDmiSafe("board_version");

        if (vendor.isEmpty()) {
            // Try dmidecode (may require sudo but works if sudoers allows it)
            String dmi = exec(5, "dmidecode", "-t", "bios");
            if (!dmi.isEmpty()) {
                Map<String, String> m = parseKeyValueOutput(dmi, ":");
                vendor  = m.getOrDefault("Vendor", "");
                version = m.getOrDefault("Version", "");
                date    = m.getOrDefault("Release Date", "");
            }
        }

        return BiosInfo.builder()
                .vendor(vendor.isEmpty()  ? "N/A" : vendor)
                .version(version.isEmpty() ? "N/A" : version)
                .releaseDate(date.isEmpty() ? "N/A" : date)
                .firmwareRevision(boardV.isEmpty() ? board : board + " v" + boardV)
                .build();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CPU
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public CpuInfo getCpuInfo() {
        Map<String, String> cpuMap = parseKeyValueOutput(readFileSafe(PROC_CPUINFO), ":");
        String model   = cpuMap.getOrDefault("model name", cpuMap.getOrDefault("Model name", "Unknown"));
        String vendor  = cpuMap.getOrDefault("vendor_id", "Unknown");
        int cores      = runtime.availableProcessors();
        double mhz     = parseMhz(cpuMap.getOrDefault("cpu MHz", "0"));
        String cache   = cpuMap.getOrDefault("cache size", "");

        // Per-core usage (delta /proc/stat, 500ms sample)
        List<Double> coreLoads = measurePerCoreCpuUsage();
        double avgLoad = coreLoads.stream().mapToDouble(d -> d).average().orElse(0.0);

        List<CpuCore> coreDetails = new ArrayList<>();
        for (int i = 0; i < coreLoads.size(); i++) {
            coreDetails.add(CpuCore.builder()
                    .coreId(i)
                    .loadPercent(coreLoads.get(i))
                    .vendor(vendor.trim())
                    .build());
        }

        return CpuInfo.builder()
                .name(model.trim())
                .vendor(vendor.trim())
                .cores(cores)
                .availableProcessors(cores)
                .architecture(System.getProperty("os.arch"))
                .clockSpeedMhz(mhz)
                .cacheSize(cache)
                .loadPercentage((int) avgLoad)
                .loadPercentageStr(String.format("%.1f", avgLoad))
                .coreDetails(coreDetails)
                .build();
    }

    protected List<Double> measurePerCoreCpuUsage() {
        try {
            long[][] before = readCpuStats();
            Thread.sleep(500);
            long[][] after  = readCpuStats();

            List<Double> loads = new ArrayList<>();
            for (int i = 0; i < Math.min(before.length, after.length); i++) {
                long idleBefore = before[i][3], idleAfter = after[i][3];
                long totalBefore = Arrays.stream(before[i]).sum();
                long totalAfter  = Arrays.stream(after[i]).sum();
                long totalDelta  = totalAfter - totalBefore;
                long idleDelta   = idleAfter  - idleBefore;
                loads.add(totalDelta > 0 ? (totalDelta - idleDelta) * 100.0 / totalDelta : 0.0);
            }
            return loads;
        } catch (Exception e) {
            log.debug("CPU delta measurement failed: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * Parse /proc/stat. Returns array[cpu_index][field_index].
     * Fields: user, nice, system, idle, iowait, irq, softirq, steal
     */
    private long[][] readCpuStats() throws IOException {
        List<long[]> stats = new ArrayList<>();
        for (String line : Files.readAllLines(PROC_STAT)) {
            if (!line.startsWith("cpu")) continue;
            String[] parts = line.trim().split("\\s+");
            if (parts[0].equals("cpu")) continue; // skip aggregate
            long[] vals = new long[8];
            for (int i = 0; i < 8 && i + 1 < parts.length; i++) vals[i] = Long.parseLong(parts[i + 1]);
            stats.add(vals);
        }
        return stats.toArray(new long[0][]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Memory
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public MemoryInfo getMemoryInfo() {
        Map<String, Long> mem = parseMeminfo();

        long totalKb    = mem.getOrDefault("MemTotal", 0L);
        long freeKb     = mem.getOrDefault("MemFree", 0L);
        long availKb    = mem.getOrDefault("MemAvailable", 0L);
        long buffersKb  = mem.getOrDefault("Buffers", 0L);
        long cachedKb   = mem.getOrDefault("Cached", 0L) + mem.getOrDefault("SReclaimable", 0L);
        long usedKb     = totalKb - availKb;
        long swapTotalKb = mem.getOrDefault("SwapTotal", 0L);
        long swapFreeKb  = mem.getOrDefault("SwapFree", 0L);
        long swapUsedKb  = swapTotalKb - swapFreeKb;

        long total = totalKb * 1024L, free = freeKb * 1024L, avail = availKb * 1024L;
        long used  = usedKb  * 1024L, buf  = buffersKb * 1024L, cached = cachedKb * 1024L;
        long swapTotal = swapTotalKb * 1024L, swapFree = swapFreeKb * 1024L, swapUsed = swapUsedKb * 1024L;
        double usedPct  = calculatePercentage(usedKb, totalKb);
        double swapPct  = calculatePercentage(swapUsedKb, swapTotalKb);

        return MemoryInfo.builder()
                .totalBytes(total).freeBytes(free).usedBytes(used)
                .totalFormatted(formatBytes(total)).freeFormatted(formatBytes(free)).usedFormatted(formatBytes(used))
                .availableFormatted(formatBytes(avail))
                .buffersFormatted(formatBytes(buf))
                .cachedFormatted(formatBytes(cached))
                .usedPercent(String.format("%.1f", usedPct))
                .swapTotalBytes(swapTotal).swapFreeBytes(swapFree).swapUsedBytes(swapUsed)
                .swapTotalFormatted(formatBytes(swapTotal)).swapFreeFormatted(formatBytes(swapFree))
                .swapUsedFormatted(formatBytes(swapUsed))
                .swapUsedPercent(String.format("%.1f", swapPct))
                .javaTotalMemory(runtime.totalMemory()).javaFreeMemory(runtime.freeMemory()).javaMaxMemory(runtime.maxMemory())
                .javaTotalFormatted(formatBytes(runtime.totalMemory()))
                .javaFreeFormatted(formatBytes(runtime.freeMemory()))
                .javaMaxFormatted(formatBytes(runtime.maxMemory()))
                .build();
    }

    @Override
    public MemoryInfo getBasicMemoryInfo() {
        Map<String, Long> mem = parseMeminfo();
        long totalKb = mem.getOrDefault("MemTotal", 0L);
        long availKb = mem.getOrDefault("MemAvailable", 0L);
        long usedKb  = totalKb - availKb;
        long total = totalKb * 1024L, avail = availKb * 1024L, used = usedKb * 1024L;
        double pct = calculatePercentage(usedKb, totalKb);
        return MemoryInfo.builder()
                .totalBytes(total).usedBytes(used).freeBytes(avail)
                .totalFormatted(formatBytes(total))
                .usedFormatted(formatBytes(used))
                .freeFormatted(formatBytes(avail))
                .availableFormatted(formatBytes(avail))
                .usedPercent(String.format("%.1f", pct))
                .javaTotalMemory(runtime.totalMemory())
                .javaFreeMemory(runtime.freeMemory())
                .javaMaxMemory(runtime.maxMemory())
                .build();
    }

    private Map<String, Long> parseMeminfo() {
        Map<String, Long> result = new HashMap<>();
        for (String line : readFileSafe(PROC_MEMINFO).split("\n")) {
            String[] parts = line.split(":\\s+");
            if (parts.length == 2) {
                try {
                    result.put(parts[0].trim(), Long.parseLong(parts[1].replace(" kB", "").trim()));
                } catch (NumberFormatException ignored) {}
            }
        }
        return result;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Disk
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public DiskInfo getDiskInfo() {
        List<DriveInfo> drives = new ArrayList<>();

        // Use lsblk for rich block device info (including external USB HDDs)
        String lsblkJson = exec(15, "lsblk", "-J", "-b", "-o",
                "NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE,VENDOR,MODEL,SERIAL,TRAN,RO,RM,HOTPLUG,LABEL");
        if (!lsblkJson.isEmpty()) {
            drives = parseLsblkDrives(lsblkJson);
        }

        // Fallback: df -B1 for mount points
        if (drives.isEmpty()) {
            drives = parseDfDrives();
        }

        long totalSpace = drives.stream().mapToLong(d -> d.getTotalBytes() != null ? d.getTotalBytes() : 0).sum();
        long freeSpace  = drives.stream().mapToLong(d -> d.getFreeBytes()  != null ? d.getFreeBytes()  : 0).sum();
        long usedSpace  = totalSpace - freeSpace;

        return DiskInfo.builder()
                .drives(drives)
                .driveCount(drives.size())
                .totalSpace(totalSpace).freeSpace(freeSpace).usedSpace(usedSpace)
                .totalSpaceFormatted(formatBytes(totalSpace))
                .freeSpaceFormatted(formatBytes(freeSpace))
                .usedSpaceFormatted(formatBytes(usedSpace))
                .build();
    }

    @SuppressWarnings("unchecked")
    private List<DriveInfo> parseLsblkDrives(String json) {
        List<DriveInfo> result = new ArrayList<>();
        try {
            Map<String, Object> root = parseJsonObject(json);
            List<Map<String, Object>> devices = (List<Map<String, Object>>) root.get("blockdevices");
            if (devices == null) return result;

            for (Map<String, Object> dev : devices) {
                String type = getStringValue(dev.get("type"), "");
                // Include disks and their partitions that have a mountpoint
                collectDriveFromDevice(dev, result);
            }
        } catch (Exception e) {
            log.debug("lsblk parse error: {}", e.getMessage());
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private void collectDriveFromDevice(Map<String, Object> dev, List<DriveInfo> result) {
        String type       = getStringValue(dev.get("type"), "");
        String name       = getStringValue(dev.get("name"), "");
        String mount      = getStringValue(dev.get("mountpoint"), "");
        String fstype     = getStringValue(dev.get("fstype"), "");
        String vendor     = getStringValue(dev.get("vendor"), "").trim();
        String model      = getStringValue(dev.get("model"), "").trim();
        String tran       = getStringValue(dev.get("tran"), "");  // usb, sata, nvme, etc.
        boolean removable = getBooleanValue(dev.get("rm"));
        boolean hotplug   = getBooleanValue(dev.get("hotplug"));
        long sizeBytes    = getLongValue(dev.get("size"));

        if (!mount.isEmpty() && !mount.equals("null")) {
            // This partition is mounted — get real usage
            DriveInfo di = getDiskUsageForPath(mount);
            String label  = getStringValue(dev.get("label"), name);
            boolean isExternal = "usb".equalsIgnoreCase(tran) || removable || hotplug;
            result.add(DriveInfo.builder()
                    .device("/dev/" + name)
                    .mountPoint(mount)
                    .fileSystem(fstype)
                    .type(isExternal ? "External (" + tran + ")" : (tran.isEmpty() ? type : tran))
                    .label(label)
                    .vendor(vendor)
                    .model(model)
                    .totalBytes(di.getTotalBytes()).freeBytes(di.getFreeBytes()).usedBytes(di.getUsedBytes())
                    .totalFormatted(di.getTotalFormatted()).freeFormatted(di.getFreeFormatted()).usedFormatted(di.getUsedFormatted())
                    .usedPercent(di.getUsedPercent())
                    .readOnly(getBooleanValue(dev.get("ro")))
                    .removable(removable)
                    .build());
        }

        // Recurse into children (partitions)
        Object children = dev.get("children");
        if (children instanceof List<?> childList) {
            for (Object child : childList) {
                if (child instanceof Map<?, ?> childMap) {
                    collectDriveFromDevice((Map<String, Object>) childMap, result);
                }
            }
        }
    }

    private List<DriveInfo> parseDfDrives() {
        List<DriveInfo> result = new ArrayList<>();
        List<String> lines = execLines("df", "-B1", "--output=source,size,used,avail,pcent,target,fstype");
        for (int i = 1; i < lines.size(); i++) {
            String[] p = lines.get(i).trim().split("\\s+");
            if (p.length < 7) continue;
            try {
                long total = Long.parseLong(p[1]), used = Long.parseLong(p[2]), free = Long.parseLong(p[3]);
                result.add(DriveInfo.builder()
                        .device(p[0]).mountPoint(p[5]).fileSystem(p[6])
                        .totalBytes(total).usedBytes(used).freeBytes(free)
                        .totalFormatted(formatBytes(total)).usedFormatted(formatBytes(used)).freeFormatted(formatBytes(free))
                        .usedPercent(p[4].replace("%", ""))
                        .build());
            } catch (NumberFormatException ignored) {}
        }
        return result;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Network (with live Rx/Tx speed)
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public NetworkInfo getNetworkInfo() {
        // Sample /proc/net/dev twice for live speed
        Map<String, long[]> before = readNetDevStats();
        try { Thread.sleep(1000); } catch (InterruptedException ignored) {}
        Map<String, long[]> after  = readNetDevStats();

        List<NetworkAdapter> adapters = new ArrayList<>();
        for (Map.Entry<String, long[]> e : after.entrySet()) {
            String iface     = e.getKey();
            long[] afterStats = e.getValue();
            long[] beforeStats = before.getOrDefault(iface, new long[16]);

            long rxBytes  = afterStats[0];
            long txBytes  = afterStats[8];
            long rxSpeed  = Math.max(0, afterStats[0]  - beforeStats[0]);
            long txSpeed  = Math.max(0, afterStats[8]  - beforeStats[8]);
            long rxErrors = afterStats[2];
            long txErrors = afterStats[10];

            // Get IP/MAC from ip command
            String ipInfo = exec("ip", "addr", "show", iface);
            String ipAddr = extractIpFromAddrShow(ipInfo);
            String macAddr = extractMacFromAddrShow(ipInfo);

            adapters.add(NetworkAdapter.builder()
                    .name(iface)
                    .ipAddress(ipAddr)
                    .macAddress(macAddr)
                    .rxBytesTotal(rxBytes)
                    .txBytesTotal(txBytes)
                    .rxBytesPerSec(rxSpeed)
                    .txBytesPerSec(txSpeed)
                    .rxBytesPerSecFormatted(formatBytes(rxSpeed) + "/s")
                    .txBytesPerSecFormatted(formatBytes(txSpeed) + "/s")
                    .rxErrors(rxErrors)
                    .txErrors(txErrors)
                    .build());
        }

        // Active connections count
        String ss = exec(5, "ss", "-tunap");
        int connCount = (int) Arrays.stream(ss.split("\n")).filter(l -> !l.startsWith("Netid")).count();

        return NetworkInfo.builder()
                .hostname(getHostname())
                .ipAddresses(getIpAddresses())
                .adapters(adapters)
                .activeConnections(connCount)
                .build();
    }

    /** Returns map: interface → [rxBytes, rxPackets, rxErrors, rxDrop, ..., txBytes, txPackets, txErrors, ...] */
    protected Map<String, long[]> readNetDevStats() {
        Map<String, long[]> result = new LinkedHashMap<>();
        try {
            for (String line : Files.readAllLines(PROC_NET_DEV)) {
                if (!line.contains(":")) continue;
                String[] parts = line.split(":");
                String iface   = parts[0].trim();
                if (iface.equals("lo")) continue;
                String[] vals  = parts[1].trim().split("\\s+");
                long[] stats   = new long[vals.length];
                for (int i = 0; i < vals.length; i++) {
                    try { stats[i] = Long.parseLong(vals[i]); } catch (NumberFormatException ignored) {}
                }
                result.put(iface, stats);
            }
        } catch (Exception e) {
            log.debug("readNetDevStats error: {}", e.getMessage());
        }
        return result;
    }

    private String extractIpFromAddrShow(String output) {
        for (String line : output.split("\n")) {
            line = line.trim();
            if (line.startsWith("inet ") && !line.contains("127.0.0.1")) {
                return line.split("\\s+")[1].split("/")[0];
            }
        }
        return "";
    }

    private String extractMacFromAddrShow(String output) {
        for (String line : output.split("\n")) {
            line = line.trim();
            if (line.startsWith("link/ether")) {
                String[] parts = line.split("\\s+");
                return parts.length > 1 ? parts[1] : "";
            }
        }
        return "";
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Processes
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public List<ProcessInfo> getRunningProcesses() {
        List<ProcessInfo> processes = new ArrayList<>();
        // ps aux gives: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
        List<String> lines = execLines("ps", "aux", "--no-headers");
        for (String line : lines) {
            try {
                String[] p = line.trim().split("\\s+", 11);
                if (p.length < 11) continue;
                processes.add(ProcessInfo.builder()
                        .user(p[0])
                        .pid(Integer.parseInt(p[1]))
                        .cpuUsage(Double.parseDouble(p[2]))
                        .memoryPercent(Double.parseDouble(p[3]))
                        .memoryBytes(Long.parseLong(p[5]) * 1024L)
                        .memoryFormatted(formatBytes(Long.parseLong(p[5]) * 1024L))
                        .state(p[7])
                        .startTimeFormatted(p[8])
                        .commandLine(p[10])
                        .name(p[10].contains("/") ? p[10].substring(p[10].lastIndexOf('/') + 1) : p[10].split("\\s")[0])
                        .build());
            } catch (Exception ignored) {}
        }
        // Sort by CPU desc, limit to top 50
        processes.sort(Comparator.comparingDouble(ProcessInfo::getCpuUsage).reversed());
        return processes.stream().limit(50).collect(Collectors.toList());
    }

    /** Returns per-user CPU/memory aggregation. */
    public Map<String, Map<String, Object>> getPerUserProcessStats() {
        Map<String, Map<String, Object>> userStats = new LinkedHashMap<>();
        List<ProcessInfo> procs = getRunningProcesses();
        for (ProcessInfo p : procs) {
            userStats.computeIfAbsent(p.getUser(), u -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("processCount", 0); m.put("totalCpuPct", 0.0); m.put("totalMemBytes", 0L);
                return m;
            });
            Map<String, Object> s = userStats.get(p.getUser());
            s.put("processCount", (int) s.get("processCount") + 1);
            s.put("totalCpuPct",  (double) s.get("totalCpuPct")  + p.getCpuUsage());
            s.put("totalMemBytes", (long) s.get("totalMemBytes") + p.getMemoryBytes());
        }
        userStats.forEach((u, s) ->
                s.put("totalMemFormatted", formatBytes((long) s.get("totalMemBytes"))));
        return userStats;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Services (systemd)
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public List<ServiceInfo> getRunningServices() {
        List<ServiceInfo> services = new ArrayList<>();
        String output = exec(10, "systemctl", "list-units", "--type=service", "--all",
                "--no-pager", "--no-legend", "--plain");
        for (String line : output.split("\n")) {
            try {
                String[] p = line.trim().split("\\s+", 5);
                if (p.length < 4) continue;
                services.add(ServiceInfo.builder()
                        .name(p[0].replace(".service", ""))
                        .loaded(p[1])
                        .active(p[2])
                        .status(p[3])
                        .description(p.length > 4 ? p[4] : "")
                        .running("active".equals(p[2]))
                        .build());
            } catch (Exception ignored) {}
        }
        return services;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Performance metrics
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public PerformanceMetrics getPerformanceMetrics() {
        String uptime  = readFileSafe(PROC_UPTIME);
        String loadavg = readFileSafe(PROC_LOADAVG);

        long uptimeSeconds = 0;
        String uptimeStr   = "";
        if (!uptime.isEmpty()) {
            uptimeSeconds = (long) Double.parseDouble(uptime.split("\\s")[0]);
            uptimeStr     = formatUptime(uptimeSeconds);
        }

        Double load1 = null, load5 = null, load15 = null;
        if (!loadavg.isEmpty()) {
            String[] parts = loadavg.split("\\s+");
            load1  = Double.parseDouble(parts[0]);
            load5  = Double.parseDouble(parts[1]);
            load15 = Double.parseDouble(parts[2]);
        }

        // CPU total usage (aggregate, 300ms sample)
        double cpuUsage = measureTotalCpuUsage();

        // Process and thread counts
        String[] la = loadavg.split("\\s+");
        int runningProcs = 0, totalProcs = 0;
        if (la.length >= 4) {
            String[] pt = la[3].split("/");
            if (pt.length == 2) {
                runningProcs = Integer.parseInt(pt[0]);
                totalProcs   = Integer.parseInt(pt[1]);
            }
        }

        // Live network speed: zero-sleep delta from cached previous /proc/net/dev sample
        Map<String, long[]> currentNet = readNetDevStats();
        long nowMs = System.currentTimeMillis();
        long rxBytesPerSec = 0L, txBytesPerSec = 0L;
        Map<String, long[]> prevNet = prevNetStats.getAndSet(currentNet);
        long prevTime = prevNetTimestamp;
        prevNetTimestamp = nowMs;
        if (prevTime > 0 && nowMs - prevTime < 60_000L && !prevNet.isEmpty()) {
            double deltaMs = nowMs - prevTime;
            for (Map.Entry<String, long[]> e : currentNet.entrySet()) {
                long[] curr = e.getValue();
                long[] prev = prevNet.getOrDefault(e.getKey(), new long[16]);
                if (curr.length > 8 && prev.length > 8) {
                    rxBytesPerSec += Math.max(0L, (long) ((curr[0] - prev[0]) * 1000.0 / deltaMs));
                    txBytesPerSec += Math.max(0L, (long) ((curr[8] - prev[8]) * 1000.0 / deltaMs));
                }
            }
        }

        // Physical memory load from /proc/meminfo
        Map<String, Long> memInfo = parseMeminfo();
        long memTotalKb = memInfo.getOrDefault("MemTotal", 0L);
        long memAvailKb = memInfo.getOrDefault("MemAvailable", 0L);
        double memLoadPct = calculatePercentage(memTotalKb - memAvailKb, memTotalKb);

        return PerformanceMetrics.builder()
                .cpuLoad1Min(load1)
                .cpuLoad5Min(load5)
                .cpuLoad15Min(load15)
                .cpuUsagePercent(cpuUsage)
                .uptime(uptimeStr)
                .uptimeSeconds(uptimeSeconds)
                .processCount(totalProcs)
                .runningProcessCount(runningProcs)
                .memoryLoadPercent(memLoadPct)
                .networkRxBytesPerSec(rxBytesPerSec)
                .networkTxBytesPerSec(txBytesPerSec)
                .networkRxFormatted(formatSpeed(rxBytesPerSec))
                .networkTxFormatted(formatSpeed(txBytesPerSec))
                .build();
    }

    private double measureTotalCpuUsage() {
        try {
            long[] before = readAggregateCpuStat();
            Thread.sleep(300);
            long[] after  = readAggregateCpuStat();
            long totalDelta = Arrays.stream(after).sum() - Arrays.stream(before).sum();
            long idleDelta  = (after[3] - before[3]) + (after[4] - before[4]); // idle + iowait
            return totalDelta > 0 ? (totalDelta - idleDelta) * 100.0 / totalDelta : 0.0;
        } catch (Exception e) {
            return 0.0;
        }
    }

    private long[] readAggregateCpuStat() throws IOException {
        for (String line : Files.readAllLines(PROC_STAT)) {
            if (line.startsWith("cpu ")) {
                String[] parts = line.trim().split("\\s+");
                long[] vals = new long[8];
                for (int i = 0; i < 8 && i + 1 < parts.length; i++) vals[i] = Long.parseLong(parts[i + 1]);
                return vals;
            }
        }
        return new long[8];
    }

    private static String formatSpeed(long bytesPerSec) {
        if (bytesPerSec >= 1_000_000L) return String.format("%.1f MB/s", bytesPerSec / 1_000_000.0);
        if (bytesPerSec >= 1_000L)     return String.format("%.1f KB/s", bytesPerSec / 1_000.0);
        return bytesPerSec + " B/s";
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Temperature & Fan speed
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public TemperatureInfo getTemperatureInfo() {
        List<TemperatureSensor> sensors = new ArrayList<>();

        // /sys/class/thermal/thermal_zone*
        collectThermalZones(sensors);

        // /sys/class/hwmon — also collects fan speeds
        List<Map<String, Object>> fanSensors = new ArrayList<>();
        collectHwmonSensors(sensors, fanSensors);

        // Try `sensors` command (lm-sensors) as supplement
        trySensorsCommand(sensors);

        double maxTemp = sensors.stream()
                .filter(s -> s.getTemperatureCelsius() != null)
                .mapToDouble(TemperatureSensor::getTemperatureCelsius)
                .max().orElse(0.0);

        return TemperatureInfo.builder()
                .sensors(sensors)
                .fanSensors(fanSensors)
                .maxTemperatureCelsius(maxTemp)
                .hasTemperatureSensors(!sensors.isEmpty())
                .monitoringSoftware("/sys/class/thermal + hwmon")
                .status(maxTemp > 80 ? "HIGH" : maxTemp > 60 ? "WARM" : "NORMAL")
                .build();
    }

    private void collectThermalZones(List<TemperatureSensor> sensors) {
        try {
            if (!Files.exists(SYS_THERMAL)) return;
            try (Stream<Path> zones = Files.list(SYS_THERMAL)) {
                zones.filter(p -> p.getFileName().toString().startsWith("thermal_zone"))
                     .sorted()
                     .forEach(zone -> {
                         String tempStr = readFileSafe(zone.resolve("temp"));
                         String type    = readFileSafe(zone.resolve("type"));
                         if (tempStr.isEmpty()) return;
                         try {
                             double tempC = Long.parseLong(tempStr) / 1000.0;
                             sensors.add(TemperatureSensor.builder()
                                     .name(type.isEmpty() ? zone.getFileName().toString() : type)
                                     .location(zone.getFileName().toString())
                                     .temperatureCelsius(tempC)
                                     .temperatureFahrenheit(tempC * 9.0 / 5.0 + 32)
                                     .status(tempC > 80 ? "HIGH" : tempC > 60 ? "WARM" : "OK")
                                     .build());
                         } catch (NumberFormatException ignored) {}
                     });
            }
        } catch (Exception e) {
            log.debug("Thermal zone read error: {}", e.getMessage());
        }
    }

    private void collectHwmonSensors(List<TemperatureSensor> sensors, List<Map<String, Object>> fanSensors) {
        try {
            if (!Files.exists(SYS_HWMON)) return;
            try (Stream<Path> hwmons = Files.list(SYS_HWMON)) {
                hwmons.sorted().forEach(hwmon -> {
                    String name = readFileSafe(hwmon.resolve("name"));

                    // Temperature inputs: temp1_input, temp2_input...
                    for (int i = 1; i <= 10; i++) {
                        Path tempPath = hwmon.resolve("temp" + i + "_input");
                        if (!Files.exists(tempPath)) break;
                        String label = readFileSafe(hwmon.resolve("temp" + i + "_label"));
                        String val   = readFileSafe(tempPath);
                        if (val.isEmpty()) continue;
                        try {
                            double tempC = Long.parseLong(val) / 1000.0;
                            sensors.add(TemperatureSensor.builder()
                                    .name((name.isEmpty() ? "hwmon" : name) + " " + (label.isEmpty() ? "temp" + i : label))
                                    .location(hwmon.getFileName().toString())
                                    .temperatureCelsius(tempC)
                                    .temperatureFahrenheit(tempC * 9.0 / 5.0 + 32)
                                    .status(tempC > 80 ? "HIGH" : tempC > 60 ? "WARM" : "OK")
                                    .build());
                        } catch (NumberFormatException ignored) {}
                    }

                    // Fan inputs: fan1_input, fan2_input...
                    for (int i = 1; i <= 5; i++) {
                        Path fanPath = hwmon.resolve("fan" + i + "_input");
                        if (!Files.exists(fanPath)) break;
                        String rpm = readFileSafe(fanPath);
                        if (rpm.isEmpty()) continue;
                        try {
                            Map<String, Object> fan = new LinkedHashMap<>();
                            fan.put("name",     (name.isEmpty() ? "fan" : name) + " fan" + i);
                            fan.put("location", hwmon.getFileName().toString());
                            fan.put("rpm",      Long.parseLong(rpm));
                            fan.put("status",   Long.parseLong(rpm) == 0 ? "STOPPED" : "RUNNING");
                            fanSensors.add(fan);
                        } catch (NumberFormatException ignored) {}
                    }
                });
            }
        } catch (Exception e) {
            log.debug("hwmon read error: {}", e.getMessage());
        }
    }

    private void trySensorsCommand(List<TemperatureSensor> sensors) {
        String output = exec(5, "sensors");
        if (output.isEmpty()) return;
        for (String line : output.split("\n")) {
            if (line.contains("°C") || line.contains("°F")) {
                try {
                    String name = line.split(":")[0].trim();
                    String val  = line.replaceAll(".*:\\s*([+-]?[0-9.]+)°C.*", "$1");
                    double tempC = Double.parseDouble(val);
                    // Only add if not already captured
                    boolean exists = sensors.stream().anyMatch(s -> s.getName().equalsIgnoreCase(name));
                    if (!exists) {
                        sensors.add(TemperatureSensor.builder()
                                .name(name).location("sensors")
                                .temperatureCelsius(tempC)
                                .temperatureFahrenheit(tempC * 9.0 / 5.0 + 32)
                                .status(tempC > 80 ? "HIGH" : tempC > 60 ? "WARM" : "OK")
                                .build());
                    }
                } catch (Exception ignored) {}
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Hardware details (USB, PCI, BIOS DMI)
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public Object getHardwareDetails() {
        Map<String, Object> hw = new LinkedHashMap<>();
        hw.put("usbDevices",  getUsbDevices());
        hw.put("pciDevices",  getPciDevices());
        hw.put("dmiInfo",     getDmiInfo());
        hw.put("cpuFlags",    getCpuFlags());
        return hw;
    }

    public List<Map<String, Object>> getUsbDevices() {
        List<Map<String, Object>> devices = new ArrayList<>();
        // lsusb output: Bus 001 Device 002: ID 1d6b:0002 Linux Foundation 2.0 root hub
        for (String line : execLines("lsusb")) {
            if (line.isBlank()) continue;
            Map<String, Object> dev = new LinkedHashMap<>();
            dev.put("raw", line.trim());
            // Parse Bus/Device/ID
            try {
                String[] parts = line.split(":");
                dev.put("bus",        line.replaceAll("Bus (\\d+).*", "$1"));
                dev.put("device",     line.replaceAll(".*Device (\\d+).*", "$1"));
                dev.put("id",         line.replaceAll(".*ID ([\\da-f:]+).*", "$1"));
                dev.put("description", parts.length >= 3 ? parts[2].trim() : "");
            } catch (Exception ignored) {}
            devices.add(dev);
        }
        return devices;
    }

    public List<Map<String, Object>> getPciDevices() {
        List<Map<String, Object>> devices = new ArrayList<>();
        for (String line : execLines("lspci")) {
            if (line.isBlank()) continue;
            Map<String, Object> dev = new LinkedHashMap<>();
            String[] p = line.split(":", 3);
            dev.put("bus",         p.length > 0 ? p[0].trim() : "");
            dev.put("class",       p.length > 1 ? p[1].trim() : "");
            dev.put("description", p.length > 2 ? p[2].trim() : line);
            devices.add(dev);
        }
        return devices;
    }

    public Map<String, String> getDmiInfo() {
        Map<String, String> dmi = new LinkedHashMap<>();
        String[] fields = {
            "sys_vendor", "product_name", "product_version", "product_serial",
            "board_vendor", "board_name", "board_version",
            "chassis_vendor", "chassis_type", "chassis_version",
            "bios_vendor", "bios_version", "bios_date"
        };
        for (String field : fields) {
            String val = readDmiSafe(field);
            if (!val.isEmpty()) dmi.put(field, val);
        }
        return dmi;
    }

    public List<String> getCpuFlags() {
        for (String line : readFileSafe(PROC_CPUINFO).split("\n")) {
            if (line.startsWith("flags") || line.startsWith("Features")) {
                String[] parts = line.split(":\\s+", 2);
                if (parts.length == 2) return Arrays.asList(parts[1].split("\\s+"));
            }
        }
        return List.of();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // OS-specific extended info
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public Object getOsSpecificInfo() {
        return buildLinuxExtendedInfo();
    }

    protected Map<String, Object> buildLinuxExtendedInfo() {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("distributionInfo", getDistributionInfo());
        info.put("installedPackages", getInstalledPackages());
        info.put("perUserProcessStats", getPerUserProcessStats());
        info.put("usbDevices",  getUsbDevices());
        info.put("pciDevices",  getPciDevices());
        info.put("kernelModules", getLoadedKernelModules());
        info.put("openPorts",   getOpenPorts());
        info.put("dmiInfo",     getDmiInfo());
        return info;
    }

    public Map<String, String> getDistributionInfo() {
        Map<String, String> info = new LinkedHashMap<>();
        String release = exec("cat", "/etc/os-release");
        for (String line : release.split("\n")) {
            String[] p = line.split("=", 2);
            if (p.length == 2) info.put(p[0].trim(), p[1].replace("\"", "").trim());
        }
        return info;
    }

    public List<?> getInstalledPackages() {
        // dpkg-query for Debian/Ubuntu
        List<Map<String, Object>> packages = new ArrayList<>();
        String output = exec(20, "dpkg-query", "-W", "-f=${Package}\t${Version}\t${Architecture}\t${Status}\n");
        if (output.isEmpty()) return packages;
        for (String line : output.split("\n")) {
            if (line.isBlank()) continue;
            String[] p = line.split("\t");
            if (p.length < 4 || !p[3].contains("installed")) continue;
            Map<String, Object> pkg = new LinkedHashMap<>();
            pkg.put("name",    p[0]);
            pkg.put("version", p[1]);
            pkg.put("arch",    p[2]);
            packages.add(pkg);
        }
        return packages;
    }

    public List<String> getLoadedKernelModules() {
        return execLines("lsmod").stream()
                .skip(1) // skip header
                .map(l -> l.split("\\s+")[0])
                .collect(Collectors.toList());
    }

    public List<Map<String, Object>> getOpenPorts() {
        List<Map<String, Object>> ports = new ArrayList<>();
        // ss -tulnp: proto, local addr:port, state, process
        String output = exec(5, "ss", "-tulnp");
        for (String line : output.split("\n")) {
            if (line.startsWith("Netid") || line.isBlank()) continue;
            try {
                String[] p = line.trim().split("\\s+");
                if (p.length < 5) continue;
                Map<String, Object> port = new LinkedHashMap<>();
                port.put("proto",     p[0]);
                port.put("state",     p[1]);
                port.put("localAddr", p[4]);
                if (p.length > 6) port.put("process", p[p.length - 1]);
                ports.add(port);
            } catch (Exception ignored) {}
        }
        return ports;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    protected String readDmiSafe(String field) {
        return readFileSafe(SYS_DMI.resolve(field));
    }

    private double parseMhz(String mhzStr) {
        try { return Double.parseDouble(mhzStr.trim()); } catch (Exception e) { return 0.0; }
    }

    protected String formatUptime(long seconds) {
        long d = seconds / 86400, h = (seconds % 86400) / 3600,
             m = (seconds % 3600) / 60, s = seconds % 60;
        StringBuilder sb = new StringBuilder();
        if (d > 0) sb.append(d).append("d ");
        if (h > 0) sb.append(h).append("h ");
        if (m > 0) sb.append(m).append("m ");
        sb.append(s).append("s");
        return sb.toString().trim();
    }
}
