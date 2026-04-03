//package com.db.dbworld.services.server;
//
//import com.db.dbworld.helpers.ProcessExecutor;
//import com.db.dbworld.payloads.server.*;
//import lombok.extern.log4j.Log4j2;
//import org.springframework.stereotype.Service;
//
//import java.io.File;
//import java.lang.management.ManagementFactory;
//import java.lang.management.RuntimeMXBean;
//import java.net.InetAddress;
//import java.net.NetworkInterface;
//import java.nio.file.FileSystems;
//import java.util.*;
//
///**
// * @deprecated Migrated to com.db.dbworld.app.system.info.collector.UnsupportedOSCollector.
// */
//@Deprecated(forRemoval = true)
//@Log4j2
//// @Service("unsupportedOSCollector") — disabled; migrated to app.system.info.collector
//public class UnsupportedOSCollector extends ServerInfoCollector {
//
//    public UnsupportedOSCollector(ProcessExecutor processExecutor) {
//        super(processExecutor);
//        log.info("UnsupportedOSCollector initialized");
//    }
//
//    @Override
//    public BaseServerInfo collect() {
//        log.info("Collecting basic system information for unsupported OS");
//
//        // Create base server info
//        BaseServerInfo baseInfo = BaseServerInfo.builder()
//                .windows(false)
//                .linux(false)
//                .raspberryPi(false)
//                .mac(false)
//                .error("Unsupported Operating System - Limited information available")
//                .build();
//
//        try {
//            // Collect basic information
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
//            // Calculate health status based on available metrics
//            baseInfo.setHealthStatus(calculateHealthStatus(baseInfo));
//
//            log.info("Basic system information collected successfully");
//
//        } catch (Exception e) {
//            log.error("Error collecting system information", e);
//            baseInfo.setError("Error: " + e.getMessage());
//        }
//
//        return baseInfo;
//    }
//
//    @Override
//    public CpuInfo getCpuInfo() {
//        log.debug("Collecting CPU information for unsupported OS");
//
//        return CpuInfo.builder()
//                .name(System.getProperty("os.arch") + " Processor")
//                .vendor(System.getProperty("java.vm.vendor", "Unknown"))
//                .availableProcessors(Runtime.getRuntime().availableProcessors())
//                .architecture(System.getProperty("os.arch", "unknown"))
//                .build();
//    }
//
//    @Override
//    public MemoryInfo getMemoryInfo() {
//        log.debug("Collecting memory information for unsupported OS");
//
//        Runtime runtime = Runtime.getRuntime();
//        long totalMemory = runtime.totalMemory();
//        long freeMemory = runtime.freeMemory();
//        long maxMemory = runtime.maxMemory();
//        long usedMemory = totalMemory - freeMemory;
//        double usedPercent = maxMemory > 0 ? (usedMemory * 100.0) / maxMemory : 0.0;
//
//        return MemoryInfo.builder()
//                .totalBytes(totalMemory)
//                .freeBytes(freeMemory)
//                .usedBytes(usedMemory)
//                .totalFormatted(formatBytes(totalMemory))
//                .freeFormatted(formatBytes(freeMemory))
//                .usedFormatted(formatBytes(usedMemory))
//                .usedPercent(String.format("%.1f", usedPercent))
//                .javaTotalMemory(totalMemory)
//                .javaFreeMemory(freeMemory)
//                .javaMaxMemory(maxMemory)
//                .javaTotalFormatted(formatBytes(totalMemory))
//                .javaFreeFormatted(formatBytes(freeMemory))
//                .javaMaxFormatted(formatBytes(maxMemory))
//                .build();
//    }
//
//    @Override
//    public DiskInfo getDiskInfo() {
//        log.debug("Collecting disk information for unsupported OS");
//
//        List<DriveInfo> drives = new ArrayList<>();
//
//        try {
//            // Get file system roots
//            File[] roots = File.listRoots();
//            if (roots != null) {
//                for (File root : roots) {
//                    long total = root.getTotalSpace();
//                    long free = root.getFreeSpace();
//                    long used = total - free;
//                    double usedPercent = calculatePercentage(used, total);
//
//                    DriveInfo drive = DriveInfo.builder()
//                            .device(root.getAbsolutePath())
//                            .mountPoint(root.getAbsolutePath())
//                            .totalBytes(total)
//                            .freeBytes(free)
//                            .usedBytes(used)
//                            .totalFormatted(formatBytes(total))
//                            .freeFormatted(formatBytes(free))
//                            .usedFormatted(formatBytes(used))
//                            .usedPercent(String.format("%.1f", usedPercent))
//                            .readOnly(!root.canWrite())
//                            .type("Local Disk")
//                            .build();
//
//                    drives.add(drive);
//                }
//            }
//
//        } catch (Exception e) {
//            log.debug("Error getting disk information", e);
//        }
//
//        // Calculate totals
//        long totalSpace = drives.stream()
//                .filter(d -> d.getTotalBytes() != null)
//                .mapToLong(DriveInfo::getTotalBytes)
//                .sum();
//        long freeSpace = drives.stream()
//                .filter(d -> d.getFreeBytes() != null)
//                .mapToLong(DriveInfo::getFreeBytes)
//                .sum();
//        long usedSpace = drives.stream()
//                .filter(d -> d.getUsedBytes() != null)
//                .mapToLong(DriveInfo::getUsedBytes)
//                .sum();
//
//        return DiskInfo.builder()
//                .drives(drives)
//                .driveCount(drives.size())
//                .totalSpace(totalSpace)
//                .freeSpace(freeSpace)
//                .usedSpace(usedSpace)
//                .totalSpaceFormatted(formatBytes(totalSpace))
//                .freeSpaceFormatted(formatBytes(freeSpace))
//                .usedSpaceFormatted(formatBytes(usedSpace))
//                .error(drives.isEmpty() ? "Unable to retrieve disk information" : null)
//                .build();
//    }
//
//    @Override
//    public NetworkInfo getNetworkInfo() {
//        log.debug("Collecting network information for unsupported OS");
//
//        NetworkInfo networkInfo = NetworkInfo.builder()
//                .hostname(getHostname())
//                .build();
//
//        try {
//            // Get IP addresses
//            List<String> ipAddresses = new ArrayList<>();
//            Enumeration<NetworkInterface> nets = NetworkInterface.getNetworkInterfaces();
//            while (nets.hasMoreElements()) {
//                NetworkInterface netint = nets.nextElement();
//                if (netint.isUp() && !netint.isLoopback()) {
//                    Enumeration<InetAddress> inetAddresses = netint.getInetAddresses();
//                    while (inetAddresses.hasMoreElements()) {
//                        InetAddress inet = inetAddresses.nextElement();
//                        if (!inet.isLoopbackAddress()) {
//                            ipAddresses.add(inet.getHostAddress());
//                        }
//                    }
//                }
//            }
//            networkInfo.setIpAddresses(ipAddresses);
//
//        } catch (Exception e) {
//            log.debug("Error getting network information", e);
//        }
//
//        return networkInfo;
//    }
//
//    @Override
//    public List<ProcessInfo> getRunningProcesses() {
//        log.debug("Collecting process information for unsupported OS");
//
//        List<ProcessInfo> processes = new ArrayList<>();
//
//        try {
//            // Get JVM process info
//            RuntimeMXBean rb = ManagementFactory.getRuntimeMXBean();
//            String name = ManagementFactory.getRuntimeMXBean().getName();
//            String[] parts = name.split("@");
//
//            ProcessInfo jvmProcess = ProcessInfo.builder()
//                    .name("java")
//                    .pid(Integer.parseInt(parts[0]))
//                    .user(System.getProperty("user.name"))
//                    .cpuUsage(0.0)
//                    .memoryBytes(Runtime.getRuntime().totalMemory())
//                    .memoryFormatted(formatBytes(Runtime.getRuntime().totalMemory()))
//                    .state("Running")
//                    .commandLine(rb.getClassPath())
//                    .build();
//
//            processes.add(jvmProcess);
//
//        } catch (Exception e) {
//            log.debug("Error getting process information", e);
//        }
//
//        return processes;
//    }
//
//    @Override
//    public List<ServiceInfo> getRunningServices() {
//        log.debug("Collecting service information for unsupported OS");
//        return Collections.emptyList();
//    }
//
//    @Override
//    public PerformanceMetrics getPerformanceMetrics() {
//        log.debug("Collecting performance metrics for unsupported OS");
//
//        Runtime runtime = Runtime.getRuntime();
//        long totalMemory = runtime.totalMemory();
//        long freeMemory = runtime.freeMemory();
//        double memoryLoadPercent = calculatePercentage(totalMemory - freeMemory, totalMemory);
//
//        // Get uptime from runtime
//        RuntimeMXBean rb = ManagementFactory.getRuntimeMXBean();
//        long uptimeSeconds = rb.getUptime() / 1000;
//
//        String uptime = formatUptime(uptimeSeconds);
//
//        return PerformanceMetrics.builder()
//                .memoryLoadPercent(memoryLoadPercent)
//                .processCount(1) // At least the JVM process
//                .uptime(uptime)
//                .uptimeSeconds(uptimeSeconds)
//                .build();
//    }
//
//    @Override
//    public TemperatureInfo getTemperatureInfo() {
//        log.debug("Collecting temperature information for unsupported OS");
//
//        return TemperatureInfo.builder()
//                .hasTemperatureSensors(false)
//                .monitoringSoftware("Not available")
//                .status("Temperature monitoring not available for this OS")
//                .error("Temperature sensors cannot be accessed on this operating system")
//                .build();
//    }
//
//    @Override
//    public Object getHardwareDetails() {
//        log.debug("Collecting hardware details for unsupported OS");
//
//        Map<String, Object> hardware = new HashMap<>();
//
//        try {
//            // Basic hardware info from system properties
//            hardware.put("osName", System.getProperty("os.name"));
//            hardware.put("osVersion", System.getProperty("os.version"));
//            hardware.put("osArchitecture", System.getProperty("os.arch"));
//            hardware.put("javaVendor", System.getProperty("java.vendor"));
//            hardware.put("javaVersion", System.getProperty("java.version"));
//
//            // CPU info
//            Map<String, Object> cpu = new HashMap<>();
//            cpu.put("availableProcessors", Runtime.getRuntime().availableProcessors());
//            cpu.put("architecture", System.getProperty("os.arch"));
//            hardware.put("cpu", cpu);
//
//            // Memory info
//            Map<String, Object> memory = new HashMap<>();
//            Runtime rt = Runtime.getRuntime();
//            memory.put("totalMemory", formatBytes(rt.totalMemory()));
//            memory.put("freeMemory", formatBytes(rt.freeMemory()));
//            memory.put("maxMemory", formatBytes(rt.maxMemory()));
//            hardware.put("memory", memory);
//
//        } catch (Exception e) {
//            log.debug("Error collecting hardware details", e);
//            hardware.put("error", e.getMessage());
//        }
//
//        return hardware;
//    }
//
//    @Override
//    public ServerInfo getServerInfo() {
//        log.debug("Collecting server information for unsupported OS");
//
//        return ServerInfo.builder()
//                .osName(System.getProperty("os.name"))
//                .osVersion(System.getProperty("os.version"))
//                .osArchitecture(System.getProperty("os.arch"))
//                .hostname(getHostname())
//                .manufacturer("Unknown")
//                .model("Unknown")
//                .kernelVersion(System.getProperty("os.version"))
//                .build();
//    }
//
//    @Override
//    public BiosInfo getBiosInfo() {
//        log.debug("Collecting BIOS information for unsupported OS");
//
//        return BiosInfo.builder()
//                .vendor("Unknown")
//                .version("Unknown")
//                .firmwareRevision("Unknown")
//                .build();
//    }
//
//    @Override
//    public Object getOsSpecificInfo() {
//        log.debug("Collecting OS-specific information for unsupported OS");
//
//        Map<String, Object> osInfo = new HashMap<>();
//        osInfo.put("osType", "Unsupported");
//        osInfo.put("warning", "Detailed OS-specific information is not available");
//        osInfo.put("systemProperties", getBasicSystemProperties());
//
//        return osInfo;
//    }
//
//    /**
//     * Format uptime in human readable format.
//     */
//    private String formatUptime(long seconds) {
//        if (seconds <= 0) return "0 seconds";
//
//        long days = seconds / (24 * 3600);
//        seconds %= (24 * 3600);
//        long hours = seconds / 3600;
//        seconds %= 3600;
//        long minutes = seconds / 60;
//        seconds %= 60;
//
//        StringBuilder uptime = new StringBuilder();
//        if (days > 0) uptime.append(days).append(" days ");
//        if (hours > 0) uptime.append(hours).append(" hours ");
//        if (minutes > 0) uptime.append(minutes).append(" minutes ");
//        if (seconds > 0) uptime.append(seconds).append(" seconds");
//
//        return uptime.toString().trim();
//    }
//
//    /**
//     * Calculate health status for unsupported OS.
//     */
//    public HealthStatus calculateHealthStatus(BaseServerInfo systemData) {
//        int score = 100;
//        List<String> warnings = new ArrayList<>();
//        List<String> issues = new ArrayList<>();
//        List<String> recommendations = new ArrayList<>();
//
//        try {
//            // Check memory usage
//            if (systemData.getMemory() != null && systemData.getMemory().getUsedPercent() != null) {
//                try {
//                    double usedPercent = Double.parseDouble(systemData.getMemory().getUsedPercent());
//                    if (usedPercent > 90) {
//                        score -= 25;
//                        issues.add("High memory usage: " + usedPercent + "%");
//                        recommendations.add("Monitor memory usage and consider optimizing applications");
//                    } else if (usedPercent > 80) {
//                        score -= 15;
//                        warnings.add("Memory usage getting high: " + usedPercent + "%");
//                    }
//                } catch (NumberFormatException e) {
//                    // Ignore
//                }
//            }
//
//            // Check disk space
//            if (systemData.getDisk() != null && systemData.getDisk().getDrives() != null) {
//                for (DriveInfo drive : systemData.getDisk().getDrives()) {
//                    if (drive.getUsedPercent() != null) {
//                        try {
//                            double usedPercent = Double.parseDouble(drive.getUsedPercent());
//                            if (usedPercent > 95) {
//                                score -= 30;
//                                issues.add("Critical disk space on " + drive.getMountPoint() + ": " + usedPercent + "% used");
//                                recommendations.add("Free up disk space on " + drive.getMountPoint());
//                            } else if (usedPercent > 90) {
//                                score -= 20;
//                                warnings.add("Low disk space on " + drive.getMountPoint() + ": " + usedPercent + "% used");
//                            }
//                        } catch (NumberFormatException e) {
//                            // Ignore
//                        }
//                    }
//                }
//            }
//
//            // Add warning about unsupported OS
//            warnings.add("Operating System not fully supported - limited information available");
//            recommendations.add("Consider using Windows, Linux, or Raspberry Pi OS for full system monitoring");
//
//            // Determine health level
//            HealthStatus.HealthLevel level;
//            if (score >= 90) level = HealthStatus.HealthLevel.EXCELLENT;
//            else if (score >= 80) level = HealthStatus.HealthLevel.GOOD;
//            else if (score >= 70) level = HealthStatus.HealthLevel.FAIR;
//            else if (score >= 60) level = HealthStatus.HealthLevel.POOR;
//            else level = HealthStatus.HealthLevel.CRITICAL;
//
//            return HealthStatus.builder()
//                    .score(Math.max(0, score))
//                    .level(level)
//                    .warnings(warnings)
//                    .issues(issues)
//                    .recommendations(recommendations)
//                    .timestamp(System.currentTimeMillis())
//                    .build();
//
//        } catch (Exception e) {
//            log.debug("Error calculating health status", e);
//            return HealthStatus.builder()
//                    .score(0)
//                    .level(HealthStatus.HealthLevel.CRITICAL)
//                    .issues(List.of("Error calculating health: " + e.getMessage()))
//                    .timestamp(System.currentTimeMillis())
//                    .build();
//        }
//    }
//
//    /**
//     * Get basic system properties.
//     */
//    public Map<String, Object> getBasicSystemProperties() {
//        Map<String, Object> props = new HashMap<>();
//
//        props.put("os.name", System.getProperty("os.name"));
//        props.put("os.version", System.getProperty("os.version"));
//        props.put("os.arch", System.getProperty("os.arch"));
//        props.put("user.name", System.getProperty("user.name"));
//        props.put("user.home", System.getProperty("user.home"));
//        props.put("user.dir", System.getProperty("user.dir"));
//        props.put("file.separator", FileSystems.getDefault().getSeparator());
//        props.put("path.separator", File.pathSeparator);
//        props.put("line.separator", System.lineSeparator().replace("\n", "\\n"));
//        props.put("java.version", System.getProperty("java.version"));
//        props.put("java.vendor", System.getProperty("java.vendor"));
//        props.put("java.home", System.getProperty("java.home"));
//
//        return props;
//    }
//}