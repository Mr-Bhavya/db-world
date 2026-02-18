//package com.db.dbworld.services.server;
//
//import com.db.dbworld.helpers.ProcessExecutor;
//import com.db.dbworld.services.server.impl.ServerInfoCollectorImpl;
//import lombok.extern.log4j.Log4j2;
//import org.springframework.stereotype.Service;
//
//import java.io.File;
//import java.nio.file.Files;
//import java.nio.file.Path;
//import java.nio.file.Paths;
//import java.util.*;
//import java.util.regex.Matcher;
//import java.util.regex.Pattern;
//
///**
// * Linux-specific system information collector.
// */
//@Log4j2
//@Service
//public class LinuxServerInfoCollector extends ServerInfoCollectorImpl {
//
//    private static final Pattern CPU_FREQUENCY_PATTERN = Pattern.compile("cpu MHz\\s+:\\s+(\\d+\\.\\d+)");
//    private static final Pattern MEMORY_PATTERN = Pattern.compile("Mem(Total|Free|Available):\\s+(\\d+)\\s+kB");
//    private static final Pattern SWAP_PATTERN = Pattern.compile("Swap(Total|Free):\\s+(\\d+)\\s+kB");
//    private static final Pattern LOAD_AVG_PATTERN = Pattern.compile("([\\d\\.]+)\\s+([\\d\\.]+)\\s+([\\d\\.]+)");
//    private static final Pattern UPTIME_PATTERN = Pattern.compile("up\\s+(.+)");
//    private static final Pattern TEMPERATURE_PATTERN = Pattern.compile("temp([0-9]+)_input:\\s+([0-9]+)");
//
//    public LinuxServerInfoCollector(ProcessExecutor processExecutor) {
//        super(processExecutor);
//    }
//
//    @Override
//    public Map<String, Object> collect() {
//        Map<String, Object> allInfo = new LinkedHashMap<>();
//
//        try {
//            // Collect common information first
//            allInfo.put("common", getCommonInfo());
//
//            // Collect OS-specific information
//            allInfo.put("osInfo", getOsInfo());
//            allInfo.put("cpu", getCpuInfo());
//            allInfo.put("memory", getMemoryInfo());
//            allInfo.put("disk", getDiskInfo());
//            allInfo.put("network", getNetworkInfo());
//            allInfo.put("systemLoad", getSystemLoad());
//            allInfo.put("temperature", getTemperatureInfo());
//            allInfo.put("hardware", getHardwareDetails());
//
//            // Get running processes (limit to 50 for performance)
//            allInfo.put("processes", getRunningProcesses().subList(0, Math.min(getRunningProcesses().size(), 50)));
//
//            // Get host-specific info
//            allInfo.put("hostInfo", getHostInfo());
//
//            // Calculate health score
//            allInfo.put("health", calculateHealthScore(allInfo));
//
//            allInfo.put("timestamp", System.currentTimeMillis());
//            allInfo.put("collector", "LinuxServerInfoCollector");
//
//        } catch (Exception e) {
//            log.error("Error collecting Linux system information", e);
//            allInfo.put("error", e.getMessage());
//        }
//
//        return allInfo;
//    }
//
//    @Override
//    public Map<String, Object> getCpuInfo() {
//        Map<String, Object> cpuInfo = new LinkedHashMap<>();
//
//        try {
//            // Read /proc/cpuinfo for detailed CPU information
//            Path filePath = Paths.get("/proc/cpuinfo");
//            String cpuInfoContent = readFileSafe(filePath);
//            if (!cpuInfoContent.isEmpty()) {
//                Map<String, String> cpuDetails = parseKeyValueOutput(cpuInfoContent, ":");
//
//                // Process multiple CPUs
//                int cpuCount = 0;
//                List<Map<String, String>> cpus = new ArrayList<>();
//                Map<String, String> currentCpu = new HashMap<>();
//
//                String[] lines = cpuInfoContent.split("\n");
//                for (String line : lines) {
//                    if (line.trim().isEmpty()) {
//                        if (!currentCpu.isEmpty()) {
//                            cpus.add(new HashMap<>(currentCpu));
//                            currentCpu.clear();
//                            cpuCount++;
//                        }
//                    } else if (line.contains(":")) {
//                        String[] parts = line.split(":", 2);
//                        if (parts.length == 2) {
//                            currentCpu.put(parts[0].trim(), parts[1].trim());
//                        }
//                    }
//                }
//
//                if (!currentCpu.isEmpty()) {
//                    cpus.add(currentCpu);
//                    cpuCount++;
//                }
//
//                cpuInfo.put("cpuCount", cpuCount);
//                cpuInfo.put("cpus", cpus);
//
//                // Extract common information from first CPU
//                if (!cpus.isEmpty()) {
//                    Map<String, String> firstCpu = cpus.getFirst();
//                    cpuInfo.put("model", firstCpu.get("model name"));
//                    cpuInfo.put("vendor", firstCpu.get("vendor_id"));
//                    cpuInfo.put("cores", firstCpu.get("cpu cores"));
//                    cpuInfo.put("siblings", firstCpu.get("siblings"));
//                    cpuInfo.put("flags", firstCpu.get("flags"));
//                }
//            }
//
//            // Get CPU frequency from /proc/cpuinfo
//            Matcher freqMatcher = CPU_FREQUENCY_PATTERN.matcher(readFileSafe(filePath));
//            if (freqMatcher.find()) {
//                cpuInfo.put("frequencyMHz", freqMatcher.group(1));
//            }
//
//            // Get CPU usage from /proc/stat
//            String statContent = readFileSafe(Paths.get("/proc/stat"));
//            if (!statContent.isEmpty()) {
//                String[] lines = statContent.split("\n");
//                for (String line : lines) {
//                    if (line.startsWith("cpu ")) {
//                        String[] parts = line.split("\\s+");
//                        if (parts.length >= 8) {
//                            long user = Long.parseLong(parts[1]);
//                            long nice = Long.parseLong(parts[2]);
//                            long system = Long.parseLong(parts[3]);
//                            long idle = Long.parseLong(parts[4]);
//                            long iowait = Long.parseLong(parts[5]);
//                            long irq = Long.parseLong(parts[6]);
//                            long softirq = Long.parseLong(parts[7]);
//
//                            long total = user + nice + system + idle + iowait + irq + softirq;
//                            long used = total - idle - iowait;
//
//                            if (total > 0) {
//                                double usagePercent = (used * 100.0) / total;
//                                cpuInfo.put("usagePercent", String.format("%.2f", usagePercent));
//                            }
//
//                            cpuInfo.put("userTicks", user);
//                            cpuInfo.put("systemTicks", system);
//                            cpuInfo.put("idleTicks", idle);
//                            cpuInfo.put("iowaitTicks", iowait);
//                        }
//                        break;
//                    }
//                }
//            }
//
//            // Get CPU temperature if available
//            cpuInfo.put("temperature", getCpuTemperature());
//
//            // Get additional info from lscpu command
//            try {
//                String lscpuOutput = exec("lscpu");
//                if (!lscpuOutput.isEmpty()) {
//                    Map<String, String> lscpuInfo = parseKeyValueOutput(lscpuOutput, ":");
//                    cpuInfo.putAll(lscpuInfo);
//                }
//            } catch (Exception e) {
//                log.debug("lscpu command failed: {}", e.getMessage());
//            }
//
//        } catch (Exception e) {
//            log.warn("Error collecting CPU info", e);
//            cpuInfo.put("error", e.getMessage());
//        }
//
//        return cpuInfo;
//    }
//
//    @Override
//    public Map<String, Object> getMemoryInfo() {
//        Map<String, Object> memoryInfo = new LinkedHashMap<>();
//
//        try {
//            // Read /proc/meminfo for memory information
//            String memInfoContent = readFileSafe(Paths.get("/proc/meminfo"));
//            if (!memInfoContent.isEmpty()) {
//                Matcher memMatcher = MEMORY_PATTERN.matcher(memInfoContent);
//                Map<String, Long> memoryValues = new HashMap<>();
//
//                while (memMatcher.find()) {
//                    String key = memMatcher.group(1);
//                    long value = Long.parseLong(memMatcher.group(2)) * 1024; // Convert kB to bytes
//                    memoryValues.put(key, value);
//                }
//
//                if (memoryValues.containsKey("Total")) {
//                    long total = memoryValues.get("Total");
//                    long available = memoryValues.getOrDefault("Available", memoryValues.getOrDefault("Free", 0L));
//                    long used = total - available;
//
//                    memoryInfo.put("totalBytes", total);
//                    memoryInfo.put("availableBytes", available);
//                    memoryInfo.put("usedBytes", used);
//                    memoryInfo.put("totalFormatted", formatBytes(total));
//                    memoryInfo.put("availableFormatted", formatBytes(available));
//                    memoryInfo.put("usedFormatted", formatBytes(used));
//
//                    if (total > 0) {
//                        double usedPercent = (used * 100.0) / total;
//                        memoryInfo.put("usedPercent", String.format("%.2f", usedPercent));
//                    }
//                }
//
//                // Get swap information
//                Matcher swapMatcher = SWAP_PATTERN.matcher(memInfoContent);
//                Map<String, Long> swapValues = new HashMap<>();
//
//                while (swapMatcher.find()) {
//                    String key = swapMatcher.group(1);
//                    long value = Long.parseLong(swapMatcher.group(2)) * 1024;
//                    swapValues.put(key, value);
//                }
//
//                if (swapValues.containsKey("Total")) {
//                    long swapTotal = swapValues.get("Total");
//                    long swapFree = swapValues.getOrDefault("Free", 0L);
//                    long swapUsed = swapTotal - swapFree;
//
//                    memoryInfo.put("swapTotalBytes", swapTotal);
//                    memoryInfo.put("swapFreeBytes", swapFree);
//                    memoryInfo.put("swapUsedBytes", swapUsed);
//                    memoryInfo.put("swapTotalFormatted", formatBytes(swapTotal));
//                    memoryInfo.put("swapFreeFormatted", formatBytes(swapFree));
//                    memoryInfo.put("swapUsedFormatted", formatBytes(swapUsed));
//
//                    if (swapTotal > 0) {
//                        double swapUsedPercent = (swapUsed * 100.0) / swapTotal;
//                        memoryInfo.put("swapUsedPercent", String.format("%.2f", swapUsedPercent));
//                    }
//                }
//            }
//
//            // Get memory info from free command
//            try {
//                String freeOutput = exec("free", "-b");
//                if (!freeOutput.isEmpty()) {
//                    String[] lines = freeOutput.split("\n");
//                    if (lines.length >= 2) {
//                        String[] memLine = lines[1].split("\\s+");
//                        if (memLine.length >= 6) {
//                            memoryInfo.put("freeTotalBytes", Long.parseLong(memLine[1]));
//                            memoryInfo.put("freeUsedBytes", Long.parseLong(memLine[2]));
//                            memoryInfo.put("freeFreeBytes", Long.parseLong(memLine[3]));
//                            memoryInfo.put("freeSharedBytes", Long.parseLong(memLine[4]));
//                            memoryInfo.put("freeBuffersBytes", Long.parseLong(memLine[5]));
//                        }
//                    }
//                }
//            } catch (Exception e) {
//                log.debug("free command failed: {}", e.getMessage());
//            }
//
//        } catch (Exception e) {
//            log.warn("Error collecting memory info", e);
//            memoryInfo.put("error", e.getMessage());
//        }
//
//        return memoryInfo;
//    }
//
//    @Override
//    public Map<String, Object> getDiskInfo() {
//        Map<String, Object> diskInfo = new LinkedHashMap<>();
//
//        try {
//            // Use df command for disk information
//            String dfOutput = exec("df", "-h", "--output=source,fstype,size,used,avail,pcent,target");
//            if (!dfOutput.isEmpty()) {
//                List<Map<String, String>> partitions = new ArrayList<>();
//                String[] lines = dfOutput.split("\n");
//
//                for (int i = 1; i < lines.length; i++) { // Skip header
//                    String line = lines[i].trim();
//                    if (!line.isEmpty()) {
//                        // Split by whitespace (keeping quoted paths together)
//                        String[] parts = line.split("\\s+");
//                        if (parts.length >= 7) {
//                            Map<String, String> partition = new LinkedHashMap<>();
//                            partition.put("filesystem", parts[0]);
//                            partition.put("type", parts[1]);
//                            partition.put("size", parts[2]);
//                            partition.put("used", parts[3]);
//                            partition.put("available", parts[4]);
//                            partition.put("usePercent", parts[5].replace("%", ""));
//                            partition.put("mountedOn", parts[6]);
//                            partitions.add(partition);
//                        }
//                    }
//                }
//
//                diskInfo.put("partitions", partitions);
//                diskInfo.put("partitionCount", partitions.size());
//
//                // Calculate total disk usage
//                long totalBytes = 0;
//                long usedBytes = 0;
//                long freeBytes = 0;
//
//                String dfBytesOutput = exec("df", "-B1");
//                if (!dfBytesOutput.isEmpty()) {
//                    String[] bytesLines = dfBytesOutput.split("\n");
//                    for (int i = 1; i < bytesLines.length; i++) {
//                        String line = bytesLines[i].trim();
//                        if (!line.isEmpty()) {
//                            String[] parts = line.split("\\s+");
//                            if (parts.length >= 6) {
//                                try {
//                                    totalBytes += Long.parseLong(parts[1]);
//                                    usedBytes += Long.parseLong(parts[2]);
//                                    freeBytes += Long.parseLong(parts[3]);
//                                } catch (NumberFormatException e) {
//                                    // Skip this line
//                                }
//                            }
//                        }
//                    }
//                }
//
//                diskInfo.put("totalBytes", totalBytes);
//                diskInfo.put("usedBytes", usedBytes);
//                diskInfo.put("freeBytes", freeBytes);
//                diskInfo.put("totalFormatted", formatBytes(totalBytes));
//                diskInfo.put("usedFormatted", formatBytes(usedBytes));
//                diskInfo.put("freeFormatted", formatBytes(freeBytes));
//
//                if (totalBytes > 0) {
//                    double usedPercent = (usedBytes * 100.0) / totalBytes;
//                    diskInfo.put("totalUsedPercent", String.format("%.2f", usedPercent));
//                }
//            }
//
//            // Get disk I/O statistics from /proc/diskstats
//            try {
//                String diskStats = readFileSafe(Paths.get("/proc/diskstats"));
//                if (!diskStats.isEmpty()) {
//                    List<Map<String, Object>> ioStats = new ArrayList<>();
//                    String[] lines = diskStats.split("\n");
//
//                    for (String line : lines) {
//                        String[] parts = line.trim().split("\\s+");
//                        if (parts.length >= 14) {
//                            Map<String, Object> stats = new HashMap<>();
//                            stats.put("device", parts[2]);
//                            stats.put("readsCompleted", Long.parseLong(parts[3]));
//                            stats.put("readsMerged", Long.parseLong(parts[4]));
//                            stats.put("sectorsRead", Long.parseLong(parts[5]));
//                            stats.put("timeReading", Long.parseLong(parts[6]));
//                            stats.put("writesCompleted", Long.parseLong(parts[7]));
//                            stats.put("writesMerged", Long.parseLong(parts[8]));
//                            stats.put("sectorsWritten", Long.parseLong(parts[9]));
//                            stats.put("timeWriting", Long.parseLong(parts[10]));
//                            ioStats.add(stats);
//                        }
//                    }
//                    diskInfo.put("ioStats", ioStats);
//                }
//            } catch (Exception e) {
//                log.debug("Error reading disk stats: {}", e.getMessage());
//            }
//
//        } catch (Exception e) {
//            log.warn("Error collecting disk info", e);
//            diskInfo.put("error", e.getMessage());
//        }
//
//        return diskInfo;
//    }
//
//    @Override
//    public Map<String, Object> getNetworkInfo() {
//        Map<String, Object> networkInfo = new LinkedHashMap<>();
//
//        try {
//            // Use ip command for network information
//            String ipOutput = exec("ip", "-o", "addr", "show");
//            if (!ipOutput.isEmpty()) {
//                List<Map<String, String>> interfaces = new ArrayList<>();
//                String[] lines = ipOutput.split("\n");
//
//                for (String line : lines) {
//                    String[] parts = line.split("\\s+");
//                    if (parts.length >= 6) {
//                        Map<String, String> iface = new HashMap<>();
//                        iface.put("interface", parts[1]);
//                        iface.put("family", parts[2]);
//
//                        // Extract IP address (could be in different positions)
//                        for (int i = 3; i < parts.length; i++) {
//                            if (parts[i].contains(".") || parts[i].contains(":")) {
//                                iface.put("address", parts[i].split("/")[0]);
//                                if (parts.length > i + 1 && parts[i + 1].startsWith("scope")) {
//                                    iface.put("scope", parts[i + 2]);
//                                }
//                                break;
//                            }
//                        }
//
//                        interfaces.add(iface);
//                    }
//                }
//                networkInfo.put("interfaces", interfaces);
//            }
//
//            // Get default gateway
//            try {
//                String routeOutput = exec("ip", "route", "show", "default");
//                if (!routeOutput.isEmpty()) {
//                    String[] parts = routeOutput.split("\\s+");
//                    if (parts.length >= 3) {
//                        networkInfo.put("defaultGateway", parts[2]);
//                    }
//                }
//            } catch (Exception e) {
//                log.debug("Error getting default gateway: {}", e.getMessage());
//            }
//
//            // Get network statistics from /proc/net/dev
//            try {
//                String netDevContent = readFileSafe(Paths.get("/proc/net/dev"));
//                if (!netDevContent.isEmpty()) {
//                    List<Map<String, Object>> netStats = new ArrayList<>();
//                    String[] lines = netDevContent.split("\n");
//
//                    for (int i = 2; i < lines.length; i++) { // Skip first two lines
//                        String line = lines[i].trim();
//                        if (!line.isEmpty()) {
//                            String[] parts = line.split(":\\s+|\\s+");
//                            if (parts.length >= 17) {
//                                Map<String, Object> stats = new HashMap<>();
//                                stats.put("interface", parts[0].trim());
//                                stats.put("rxBytes", Long.parseLong(parts[1]));
//                                stats.put("rxPackets", Long.parseLong(parts[2]));
//                                stats.put("rxErrors", Long.parseLong(parts[3]));
//                                stats.put("rxDropped", Long.parseLong(parts[4]));
//                                stats.put("txBytes", Long.parseLong(parts[9]));
//                                stats.put("txPackets", Long.parseLong(parts[10]));
//                                stats.put("txErrors", Long.parseLong(parts[11]));
//                                stats.put("txDropped", Long.parseLong(parts[12]));
//                                netStats.add(stats);
//                            }
//                        }
//                    }
//                    networkInfo.put("statistics", netStats);
//                }
//            } catch (Exception e) {
//                log.debug("Error reading network stats: {}", e.getMessage());
//            }
//
//            // Get DNS information
//            try {
//                String resolvContent = readFileSafe(Paths.get("/etc/resolv.conf"));
//                if (!resolvContent.isEmpty()) {
//                    List<String> dnsServers = new ArrayList<>();
//                    String[] lines = resolvContent.split("\n");
//
//                    for (String line : lines) {
//                        if (line.startsWith("nameserver")) {
//                            String[] parts = line.split("\\s+");
//                            if (parts.length >= 2) {
//                                dnsServers.add(parts[1]);
//                            }
//                        }
//                    }
//                    networkInfo.put("dnsServers", dnsServers);
//                }
//            } catch (Exception e) {
//                log.debug("Error reading DNS config: {}", e.getMessage());
//            }
//
//        } catch (Exception e) {
//            log.warn("Error collecting network info", e);
//            networkInfo.put("error", e.getMessage());
//        }
//
//        return networkInfo;
//    }
//
//    @Override
//    public List<Map<String, Object>> getRunningProcesses() {
//        List<Map<String, Object>> processes = new ArrayList<>();
//
//        try {
//            // Use ps command for process information
//            String psOutput = exec("ps", "aux");
//            if (!psOutput.isEmpty()) {
//                String[] lines = psOutput.split("\n");
//
//                for (int i = 1; i < lines.length; i++) { // Skip header
//                    String line = lines[i].trim();
//                    if (!line.isEmpty()) {
//                        String[] parts = line.split("\\s+", 11);
//                        if (parts.length >= 11) {
//                            Map<String, Object> process = new HashMap<>();
//                            process.put("user", parts[0]);
//                            process.put("pid", parts[1]);
//                            process.put("cpu", parts[2]);
//                            process.put("mem", parts[3]);
//                            process.put("vsz", parts[4]);
//                            process.put("rss", parts[5]);
//                            process.put("tty", parts[6]);
//                            process.put("stat", parts[7]);
//                            process.put("start", parts[8]);
//                            process.put("time", parts[9]);
//                            process.put("command", parts[10]);
//                            processes.add(process);
//                        }
//                    }
//                }
//            }
//
//            // Get total process count
//            try {
//                String processCount = exec("ps", "-e", "--no-headers");
//                if (!processCount.isEmpty()) {
//                    int count = processCount.split("\n").length;
//                    processes.addFirst(Map.of("_totalProcesses", count));
//                }
//            } catch (Exception e) {
//                log.debug("Error counting processes: {}", e.getMessage());
//            }
//
//        } catch (Exception e) {
//            log.warn("Error collecting process info", e);
//            Map<String, Object> errorProcess = new HashMap<>();
//            errorProcess.put("error", e.getMessage());
//            processes.add(errorProcess);
//        }
//
//        return processes;
//    }
//
//    @Override
//    public Map<String, Object> getSystemLoad() {
//        Map<String, Object> loadInfo = new LinkedHashMap<>();
//
//        try {
//            // Get load average from /proc/loadavg
//            String loadAvgContent = readFileSafe(Paths.get("/proc/loadavg"));
//            if (!loadAvgContent.isEmpty()) {
//                Matcher loadMatcher = LOAD_AVG_PATTERN.matcher(loadAvgContent);
//                if (loadMatcher.find()) {
//                    loadInfo.put("load1Min", loadMatcher.group(1));
//                    loadInfo.put("load5Min", loadMatcher.group(2));
//                    loadInfo.put("load15Min", loadMatcher.group(3));
//
//                    // Get number of CPUs for normalized load
//                    int cpuCount = runtime.availableProcessors();
//                    loadInfo.put("cpuCount", cpuCount);
//
//                    try {
//                        double load1 = Double.parseDouble(loadMatcher.group(1));
//                        double load5 = Double.parseDouble(loadMatcher.group(2));
//                        double load15 = Double.parseDouble(loadMatcher.group(3));
//
//                        loadInfo.put("load1Norm", String.format("%.2f", load1 / cpuCount));
//                        loadInfo.put("load5Norm", String.format("%.2f", load5 / cpuCount));
//                        loadInfo.put("load15Norm", String.format("%.2f", load15 / cpuCount));
//                    } catch (NumberFormatException e) {
//                        // Ignore parse errors
//                    }
//                }
//            }
//
//            // Get uptime from /proc/uptime
//            String uptimeContent = readFileSafe(Paths.get("/proc/uptime"));
//            if (!uptimeContent.isEmpty()) {
//                String[] parts = uptimeContent.split("\\s+");
//                if (parts.length >= 2) {
//                    double uptimeSeconds = Double.parseDouble(parts[0]);
//                    double idleSeconds = Double.parseDouble(parts[1]);
//
//                    loadInfo.put("uptimeSeconds", uptimeSeconds);
//                    loadInfo.put("idleSeconds", idleSeconds);
//
//                    // Format uptime nicely
//                    long uptime = (long) uptimeSeconds;
//                    long days = uptime / (24 * 3600);
//                    long hours = (uptime % (24 * 3600)) / 3600;
//                    long minutes = (uptime % 3600) / 60;
//                    long seconds = uptime % 60;
//
//                    String formattedUptime = String.format("%d days, %02d:%02d:%02d", days, hours, minutes, seconds);
//                    loadInfo.put("uptimeFormatted", formattedUptime);
//                }
//            }
//
//            // Get uptime from uptime command for additional info
//            try {
//                String uptimeOutput = exec("uptime");
//                if (!uptimeOutput.isEmpty()) {
//                    loadInfo.put("uptimeCommand", uptimeOutput.trim());
//
//                    // Parse users from uptime
//                    String[] parts = uptimeOutput.split(",");
//                    if (parts.length >= 4) {
//                        loadInfo.put("users", parts[parts.length - 3].trim());
//                    }
//                }
//            } catch (Exception e) {
//                log.debug("uptime command failed: {}", e.getMessage());
//            }
//
//            // Get system time
//            loadInfo.put("currentTime", System.currentTimeMillis());
//            loadInfo.put("currentTimeFormatted", new Date().toString());
//
//        } catch (Exception e) {
//            log.warn("Error collecting system load info", e);
//            loadInfo.put("error", e.getMessage());
//        }
//
//        return loadInfo;
//    }
//
//    @Override
//    public Map<String, Object> getTemperatureInfo() {
//        Map<String, Object> tempInfo = new LinkedHashMap<>();
//
//        try {
//            // Check for thermal zones in /sys/class/thermal
//            File thermalDir = new File("/sys/class/thermal");
//            if (thermalDir.exists() && thermalDir.isDirectory()) {
//                File[] thermalZones = thermalDir.listFiles((dir, name) -> name.startsWith("thermal_zone"));
//
//                if (thermalZones != null && thermalZones.length > 0) {
//                    List<Map<String, Object>> temperatures = new ArrayList<>();
//
//                    for (File zone : thermalZones) {
//                        try {
//                            Map<String, Object> zoneInfo = new HashMap<>();
//                            String zoneName = readFileSafe(Paths.get(zone.getAbsolutePath(), "type"));
//                            String tempStr = readFileSafe(Paths.get(zone.getAbsolutePath(), "temp"));
//
//                            if (!zoneName.isEmpty() && !tempStr.isEmpty()) {
//                                try {
//                                    double tempMilliC = Double.parseDouble(tempStr);
//                                    double tempC = tempMilliC / 1000.0;
//                                    double tempF = (tempC * 9.0 / 5.0) + 32;
//
//                                    zoneInfo.put("zone", zone.getAbsolutePath());
//                                    zoneInfo.put("name", zoneName.trim());
//                                    zoneInfo.put("tempC", String.format("%.1f", tempC));
//                                    zoneInfo.put("tempF", String.format("%.1f", tempF));
//                                    zoneInfo.put("rawMilliC", tempMilliC);
//
//                                    temperatures.add(zoneInfo);
//                                } catch (NumberFormatException e) {
//                                    // Skip invalid temperature
//                                }
//                            }
//                        } catch (Exception e) {
//                            log.debug("Error reading thermal zone {}: {}", zone.getName(), e.getMessage());
//                        }
//                    }
//
//                    tempInfo.put("thermalZones", temperatures);
//                    tempInfo.put("zoneCount", temperatures.size());
//
//                    // Calculate average temperature
//                    if (!temperatures.isEmpty()) {
//                        double avgTempC = temperatures.stream()
//                                .mapToDouble(z -> Double.parseDouble(z.get("tempC").toString()))
//                                .average()
//                                .orElse(0.0);
//                        tempInfo.put("averageTempC", String.format("%.1f", avgTempC));
//                    }
//                }
//            }
//
//            // Check for CPU temperature specifically
//            Map<String, Object> cpuTemp = getCpuTemperature();
//            if (!cpuTemp.isEmpty()) {
//                tempInfo.put("cpuTemperature", cpuTemp);
//            }
//
//            // Try sensors command if available
//            try {
//                String sensorsOutput = exec("sensors");
//                if (!sensorsOutput.isEmpty()) {
//                    // Parse sensors output for temperature readings
//                    List<Map<String, String>> sensorReadings = new ArrayList<>();
//                    String[] lines = sensorsOutput.split("\n");
//
//                    for (String line : lines) {
//                        if (line.contains("°C") || line.contains("°F")) {
//                            Map<String, String> reading = new HashMap<>();
//                            reading.put("reading", line.trim());
//                            sensorReadings.add(reading);
//                        }
//                    }
//
//                    if (!sensorReadings.isEmpty()) {
//                        tempInfo.put("sensorsOutput", sensorReadings);
//                    }
//                }
//            } catch (Exception e) {
//                log.debug("sensors command failed: {}", e.getMessage());
//            }
//
//        } catch (Exception e) {
//            log.warn("Error collecting temperature info", e);
//            tempInfo.put("error", e.getMessage());
//        }
//
//        return tempInfo;
//    }
//
//    @Override
//    public Map<String, Object> getHardwareDetails() {
//        Map<String, Object> hardwareInfo = new LinkedHashMap<>();
//
//        try {
//            // Get motherboard/BIOS information
//            try {
//                String dmidecodeOutput = exec("dmidecode", "-t", "system");
//                if (!dmidecodeOutput.isEmpty()) {
//                    Map<String, String> systemInfo = parseDmiDecode(dmidecodeOutput);
//                    hardwareInfo.put("system", systemInfo);
//                }
//            } catch (Exception e) {
//                log.debug("dmidecode system failed: {}", e.getMessage());
//            }
//
//            // Get BIOS information
//            try {
//                String biosOutput = exec("dmidecode", "-t", "bios");
//                if (!biosOutput.isEmpty()) {
//                    Map<String, String> biosInfo = parseDmiDecode(biosOutput);
//                    hardwareInfo.put("bios", biosInfo);
//                }
//            } catch (Exception e) {
//                log.debug("dmidecode bios failed: {}", e.getMessage());
//            }
//
//            // Get memory module information
//            try {
//                String memoryOutput = exec("dmidecode", "-t", "memory");
//                if (!memoryOutput.isEmpty()) {
//                    List<Map<String, String>> memoryModules = parseDmiDecodeMultiple(memoryOutput);
//                    hardwareInfo.put("memoryModules", memoryModules);
//                    hardwareInfo.put("memoryModuleCount", memoryModules.size());
//                }
//            } catch (Exception e) {
//                log.debug("dmidecode memory failed: {}", e.getMessage());
//            }
//
//            // Get graphics card information
//            try {
//                String lspciOutput = exec("lspci", "-v");
//                if (!lspciOutput.isEmpty()) {
//                    List<Map<String, String>> pciDevices = parseLspciOutput(lspciOutput);
//                    hardwareInfo.put("pciDevices", pciDevices);
//
//                    // Filter for graphics cards
//                    List<Map<String, String>> graphicsCards = pciDevices.stream()
//                            .filter(device -> device.get("class") != null &&
//                                    device.get("class").toLowerCase().contains("vga"))
//                            .toList();
//                    hardwareInfo.put("graphicsCards", graphicsCards);
//                }
//            } catch (Exception e) {
//                log.debug("lspci failed: {}", e.getMessage());
//            }
//
//            // Get USB devices
//            try {
//                String lsusbOutput = exec("lsusb");
//                if (!lsusbOutput.isEmpty()) {
//                    List<Map<String, String>> usbDevices = new ArrayList<>();
//                    String[] lines = lsusbOutput.split("\n");
//
//                    for (String line : lines) {
//                        if (line.trim().startsWith("Bus")) {
//                            Map<String, String> usbDevice = new HashMap<>();
//                            usbDevice.put("description", line.trim());
//                            usbDevices.add(usbDevice);
//                        }
//                    }
//                    hardwareInfo.put("usbDevices", usbDevices);
//                }
//            } catch (Exception e) {
//                log.debug("lsusb failed: {}", e.getMessage());
//            }
//
//            // Get audio devices
//            try {
//                String aplayOutput = exec("aplay", "-l");
//                if (!aplayOutput.isEmpty()) {
//                    hardwareInfo.put("audioDevices", aplayOutput);
//                }
//            } catch (Exception e) {
//                log.debug("aplay failed: {}", e.getMessage());
//            }
//
//            // Get kernel modules
//            try {
//                String lsmodOutput = exec("lsmod");
//                if (!lsmodOutput.isEmpty()) {
//                    List<Map<String, String>> modules = new ArrayList<>();
//                    String[] lines = lsmodOutput.split("\n");
//
//                    for (int i = 1; i < lines.length; i++) { // Skip header
//                        String line = lines[i].trim();
//                        if (!line.isEmpty()) {
//                            String[] parts = line.split("\\s+");
//                            if (parts.length >= 3) {
//                                Map<String, String> module = new HashMap<>();
//                                module.put("name", parts[0]);
//                                module.put("size", parts[1]);
//                                module.put("usedBy", parts[2]);
//                                module.put("dependencies", parts.length > 3 ? parts[3] : "");
//                                modules.add(module);
//                            }
//                        }
//                    }
//                    hardwareInfo.put("kernelModules", modules);
//                    hardwareInfo.put("moduleCount", modules.size());
//                }
//            } catch (Exception e) {
//                log.debug("lsmod failed: {}", e.getMessage());
//            }
//
//        } catch (Exception e) {
//            log.warn("Error collecting hardware details", e);
//            hardwareInfo.put("error", e.getMessage());
//        }
//
//        return hardwareInfo;
//    }
//
//    /**
//     * Get OS-specific information for Linux.
//     */
//    private Map<String, Object> getOsInfo() {
//        Map<String, Object> osInfo = new LinkedHashMap<>();
//
//        try {
//            // Get kernel information
//            String unameOutput = exec("uname", "-a");
//            if (!unameOutput.isEmpty()) {
//                osInfo.put("kernel", unameOutput.trim());
//            }
//
//            // Get distribution information
//            File osRelease = new File("/etc/os-release");
//            if (osRelease.exists()) {
//                String osReleaseContent = readFileSafe(osRelease.toPath());
//                if (!osReleaseContent.isEmpty()) {
//                    Map<String, String> osDetails = parseKeyValueOutput(osReleaseContent, "=");
//
//                    // Clean up values (remove quotes)
//                    for (Map.Entry<String, String> entry : osDetails.entrySet()) {
//                        String value = entry.getValue();
//                        if (value.startsWith("\"") && value.endsWith("\"")) {
//                            osDetails.put(entry.getKey(), value.substring(1, value.length() - 1));
//                        }
//                    }
//
//                    osInfo.putAll(osDetails);
//                }
//            }
//
//            // Get kernel version from /proc/version
//            String procVersion = readFileSafe(Paths.get("/proc/version"));
//            if (!procVersion.isEmpty()) {
//                osInfo.put("procVersion", procVersion.trim());
//            }
//
//            // Get hostname
//            osInfo.put("hostname", getHostname());
//
//            // Get timezone
//            try {
//                String timezone = readFileSafe(Paths.get("/etc/timezone"));
//                if (timezone.isEmpty()) {
//                    // Try another common location
//                    Path localtime = Paths.get("/etc/localtime");
//                    if (Files.exists(localtime)) {
//                        Path link = Files.readSymbolicLink(localtime);
//                        if (link != null) {
//                            timezone = link.toString();
//                        }
//                    }
//                }
//                osInfo.put("timezone", timezone.trim());
//            } catch (Exception e) {
//                osInfo.put("timezone", TimeZone.getDefault().getID());
//            }
//
//            // Get system architecture
//            String arch = exec("uname", "-m");
//            if (!arch.isEmpty()) {
//                osInfo.put("architecture", arch.trim());
//            }
//
//            // Get system locale
//            String locale = exec("locale");
//            if (!locale.isEmpty()) {
//                osInfo.put("locale", locale.trim());
//            }
//
//        } catch (Exception e) {
//            log.warn("Error collecting OS info", e);
//            osInfo.put("error", e.getMessage());
//        }
//
//        return osInfo;
//    }
//
//    /**
//     * Get host-specific information.
//     */
//    private Map<String, Object> getHostInfo() {
//        Map<String, Object> hostInfo = new HashMap<>();
//
//        try {
//            hostInfo.put("hostname", getHostname());
//            hostInfo.put("ipAddresses", getIpAddresses());
//            hostInfo.put("javaHome", System.getProperty("java.home"));
//            hostInfo.put("userHome", System.getProperty("user.home"));
//            hostInfo.put("workingDirectory", System.getProperty("user.dir"));
//
//            // Get environment information
//            Map<String, String> env = new HashMap<>();
//            for (Map.Entry<String, String> entry : System.getenv().entrySet()) {
//                // Only include certain environment variables for security
//                String key = entry.getKey();
//                if (key.startsWith("PATH") || key.startsWith("HOME") ||
//                        key.startsWith("USER") || key.startsWith("LANG") ||
//                        key.startsWith("SHELL") || key.equals("PWD")) {
//                    env.put(key, entry.getValue());
//                }
//            }
//            hostInfo.put("environment", env);
//
//        } catch (Exception e) {
//            log.warn("Error collecting host info", e);
//            hostInfo.put("error", e.getMessage());
//        }
//
//        return hostInfo;
//    }
//
//    /**
//     * Get CPU temperature from various sources.
//     */
//    private Map<String, Object> getCpuTemperature() {
//        Map<String, Object> cpuTemp = new HashMap<>();
//
//        try {
//            // Try /sys/class/hwmon for CPU temperature
//            File hwmonDir = new File("/sys/class/hwmon");
//            if (hwmonDir.exists() && hwmonDir.isDirectory()) {
//                File[] hwmonDevices = hwmonDir.listFiles();
//
//                if (hwmonDevices != null) {
//                    for (File device : hwmonDevices) {
//                        File nameFile = new File(device, "name");
//                        if (nameFile.exists()) {
//                            String deviceName = readFileSafe(nameFile.toPath());
//                            if (deviceName.toLowerCase().contains("cpu") ||
//                                    deviceName.toLowerCase().contains("core")) {
//
//                                // Look for temperature files
//                                File[] tempFiles = device.listFiles((dir, name) ->
//                                        name.startsWith("temp") && name.contains("_input"));
//
//                                if (tempFiles != null && tempFiles.length > 0) {
//                                    for (File tempFile : tempFiles) {
//                                        String tempStr = readFileSafe(tempFile.toPath());
//                                        if (!tempStr.isEmpty()) {
//                                            try {
//                                                double tempMilliC = Double.parseDouble(tempStr);
//                                                double tempC = tempMilliC / 1000.0;
//                                                cpuTemp.put("source", deviceName.trim());
//                                                cpuTemp.put("tempC", String.format("%.1f", tempC));
//                                                cpuTemp.put("device", device.getName());
//                                                cpuTemp.put("file", tempFile.getName());
//                                                return cpuTemp;
//                                            } catch (NumberFormatException e) {
//                                                // Continue to next file
//                                            }
//                                        }
//                                    }
//                                }
//                            }
//                        }
//                    }
//                }
//            }
//
//            // Try thermal zones specifically for CPU
//            File thermalDir = new File("/sys/class/thermal");
//            if (thermalDir.exists() && thermalDir.isDirectory()) {
//                File[] thermalZones = thermalDir.listFiles((dir, name) -> name.startsWith("thermal_zone"));
//
//                if (thermalZones != null) {
//                    for (File zone : thermalZones) {
//                        String zoneType = readFileSafe(Paths.get(zone.getAbsolutePath(), "type"));
//                        if (zoneType.toLowerCase().contains("cpu") ||
//                                zoneType.toLowerCase().contains("x86") ||
//                                zoneType.toLowerCase().contains("acpitz")) {
//
//                            String tempStr = readFileSafe(Paths.get(zone.getAbsolutePath(), "temp"));
//                            if (!tempStr.isEmpty()) {
//                                try {
//                                    double tempMilliC = Double.parseDouble(tempStr);
//                                    double tempC = tempMilliC / 1000.0;
//                                    cpuTemp.put("source", "thermal_zone");
//                                    cpuTemp.put("zoneType", zoneType.trim());
//                                    cpuTemp.put("tempC", String.format("%.1f", tempC));
//                                    return cpuTemp;
//                                } catch (NumberFormatException e) {
//                                    // Continue to next zone
//                                }
//                            }
//                        }
//                    }
//                }
//            }
//
//        } catch (Exception e) {
//            log.debug("Error getting CPU temperature: {}", e.getMessage());
//        }
//
//        return cpuTemp;
//    }
//
//    /**
//     * Parse dmidecode output.
//     */
//    private Map<String, String> parseDmiDecode(String output) {
//        Map<String, String> result = new LinkedHashMap<>();
//        String[] lines = output.split("\n");
//
//        String currentSection = "";
//        for (String line : lines) {
//            line = line.trim();
//            if (line.startsWith("Handle") || line.isEmpty()) {
//                continue;
//            }
//
//            if (line.contains(":")) {
//                String[] parts = line.split(":", 2);
//                if (parts.length == 2) {
//                    String key = parts[0].trim();
//                    String value = parts[1].trim();
//
//                    if (!key.isEmpty() && !value.isEmpty()) {
//                        result.put(key, value);
//                    }
//                }
//            }
//        }
//
//        return result;
//    }
//
//    /**
//     * Parse multiple entries from dmidecode output.
//     */
//    private List<Map<String, String>> parseDmiDecodeMultiple(String output) {
//        List<Map<String, String>> entries = new ArrayList<>();
//        String[] sections = output.split("\\n\\n");
//
//        for (String section : sections) {
//            if (section.contains("DMI type") && !section.contains("Information not available")) {
//                Map<String, String> entry = parseDmiDecode(section);
//                if (!entry.isEmpty()) {
//                    entries.add(entry);
//                }
//            }
//        }
//
//        return entries;
//    }
//
//    /**
//     * Parse lspci output.
//     */
//    private List<Map<String, String>> parseLspciOutput(String output) {
//        List<Map<String, String>> devices = new ArrayList<>();
//        String[] sections = output.split("\\n\\n");
//
//        for (String section : sections) {
//            if (!section.trim().isEmpty()) {
//                Map<String, String> device = new HashMap<>();
//                String[] lines = section.split("\n");
//
//                for (String line : lines) {
//                    line = line.trim();
//                    if (line.contains(":")) {
//                        String[] parts = line.split(":", 2);
//                        if (parts.length == 2) {
//                            String key = parts[0].trim();
//                            String value = parts[1].trim();
//
//                            if (!key.isEmpty() && !value.isEmpty()) {
//                                device.put(key.toLowerCase().replace(" ", ""), value);
//                            }
//                        }
//                    } else if (line.contains("\t")) {
//                        // Handle indented lines (capabilities, etc.)
//                        device.put("capabilities", device.getOrDefault("capabilities", "") + line.trim() + "; ");
//                    }
//                }
//
//                if (!device.isEmpty()) {
//                    devices.add(device);
//                }
//            }
//        }
//
//        return devices;
//    }
//}