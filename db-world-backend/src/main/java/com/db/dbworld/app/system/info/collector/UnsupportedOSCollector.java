package com.db.dbworld.app.system.info.collector;

import com.db.dbworld.core.processor.ProcessExecutor;
import com.db.dbworld.app.system.info.dto.*;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.io.File;
import java.lang.management.ManagementFactory;
import java.lang.management.RuntimeMXBean;
import java.net.NetworkInterface;
import java.util.*;

/**
 * Fallback collector for unsupported operating systems.
 * Returns basic information available through the Java Runtime.
 * Migrated from com.db.dbworld.services.server.UnsupportedOSCollector.
 */
@Log4j2
@Service("unsupportedOSCollector")
public class UnsupportedOSCollector extends ServerInfoCollector {

    public UnsupportedOSCollector(ProcessExecutor processExecutor) {
        super(processExecutor);
        log.info("UnsupportedOSCollector initialized");
    }

    @Override
    public BaseServerInfo collect() {
        BaseServerInfo info = BaseServerInfo.builder()
                .windows(false).linux(false).raspberryPi(false).mac(false)
                .error("Unsupported OS – limited information available")
                .build();
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
        } catch (Exception e) {
            log.error("Error collecting info on unsupported OS", e);
            info.setError("Error: " + e.getMessage());
        }
        return info;
    }

    @Override
    public CpuInfo getCpuInfo() {
        return CpuInfo.builder()
                .name(System.getProperty("os.arch") + " Processor")
                .vendor(System.getProperty("java.vm.vendor", "Unknown"))
                .availableProcessors(runtime.availableProcessors())
                .architecture(System.getProperty("os.arch", "unknown"))
                .build();
    }

    @Override
    public MemoryInfo getMemoryInfo() {
        long total = runtime.totalMemory(), free = runtime.freeMemory(),
             max   = runtime.maxMemory(),  used = total - free;
        return MemoryInfo.builder()
                .totalBytes(total).freeBytes(free).usedBytes(used)
                .totalFormatted(formatBytes(total)).freeFormatted(formatBytes(free)).usedFormatted(formatBytes(used))
                .usedPercent(String.format("%.1f", max > 0 ? (used * 100.0 / max) : 0.0))
                .javaTotalMemory(total).javaFreeMemory(free).javaMaxMemory(max)
                .javaTotalFormatted(formatBytes(total)).javaFreeFormatted(formatBytes(free)).javaMaxFormatted(formatBytes(max))
                .build();
    }

    @Override
    public DiskInfo getDiskInfo() {
        List<DriveInfo> drives = new ArrayList<>();
        File[] roots = File.listRoots();
        if (roots != null) {
            for (File root : roots) {
                long total = root.getTotalSpace(), free = root.getFreeSpace(), used = total - free;
                drives.add(DriveInfo.builder()
                        .device(root.getAbsolutePath()).mountPoint(root.getAbsolutePath())
                        .totalBytes(total).freeBytes(free).usedBytes(used)
                        .totalFormatted(formatBytes(total)).freeFormatted(formatBytes(free)).usedFormatted(formatBytes(used))
                        .usedPercent(String.format("%.1f", calculatePercentage(used, total)))
                        .type("Local Disk").readOnly(!root.canWrite())
                        .build());
            }
        }
        long totalSpace = drives.stream().mapToLong(d -> d.getTotalBytes() != null ? d.getTotalBytes() : 0).sum();
        long freeSpace  = drives.stream().mapToLong(d -> d.getFreeBytes()  != null ? d.getFreeBytes()  : 0).sum();
        return DiskInfo.builder()
                .drives(drives).driveCount(drives.size())
                .totalSpace(totalSpace).freeSpace(freeSpace).usedSpace(totalSpace - freeSpace)
                .totalSpaceFormatted(formatBytes(totalSpace)).freeSpaceFormatted(formatBytes(freeSpace))
                .usedSpaceFormatted(formatBytes(totalSpace - freeSpace))
                .error(drives.isEmpty() ? "Unable to retrieve disk information" : null)
                .build();
    }

    @Override
    public NetworkInfo getNetworkInfo() {
        NetworkInfo net = NetworkInfo.builder().hostname(getHostname()).build();
        try {
            List<String> ips = new ArrayList<>();
            Enumeration<NetworkInterface> nets = NetworkInterface.getNetworkInterfaces();
            while (nets.hasMoreElements()) {
                NetworkInterface ni = nets.nextElement();
                if (ni.isUp() && !ni.isLoopback()) {
                    Enumeration<java.net.InetAddress> addrs = ni.getInetAddresses();
                    while (addrs.hasMoreElements()) {
                        java.net.InetAddress a = addrs.nextElement();
                        if (!a.isLoopbackAddress()) ips.add(a.getHostAddress());
                    }
                }
            }
            net.setIpAddresses(ips);
        } catch (Exception e) {
            log.debug("Network info error", e);
        }
        return net;
    }

    @Override
    public List<ProcessInfo> getRunningProcesses() {
        try {
            RuntimeMXBean rb = ManagementFactory.getRuntimeMXBean();
            String[] parts   = rb.getName().split("@");
            return List.of(ProcessInfo.builder()
                    .name("java").pid(Integer.parseInt(parts[0]))
                    .user(System.getProperty("user.name"))
                    .cpuUsage(0.0).memoryBytes(runtime.totalMemory())
                    .memoryFormatted(formatBytes(runtime.totalMemory()))
                    .state("Running").commandLine(rb.getClassPath())
                    .build());
        } catch (Exception e) { return List.of(); }
    }

    @Override
    public List<ServiceInfo> getRunningServices() { return List.of(); }

    @Override
    public PerformanceMetrics getPerformanceMetrics() {
        long uptimeMs = ManagementFactory.getRuntimeMXBean().getUptime();
        return PerformanceMetrics.builder()
                .memoryLoadPercent(calculatePercentage(runtime.totalMemory() - runtime.freeMemory(), runtime.totalMemory()))
                .processCount(1)
                .uptime(formatUptime(uptimeMs / 1000))
                .uptimeSeconds(uptimeMs / 1000)
                .build();
    }

    @Override
    public TemperatureInfo getTemperatureInfo() {
        return TemperatureInfo.builder()
                .hasTemperatureSensors(false)
                .monitoringSoftware("N/A")
                .status("Not available on unsupported OS")
                .error("Temperature sensors cannot be accessed on this OS")
                .build();
    }

    @Override
    public Object getHardwareDetails() {
        Map<String, Object> hw = new LinkedHashMap<>();
        hw.put("osName",        System.getProperty("os.name"));
        hw.put("osVersion",     System.getProperty("os.version"));
        hw.put("osArch",        System.getProperty("os.arch"));
        hw.put("javaVersion",   System.getProperty("java.version"));
        hw.put("availableCores",runtime.availableProcessors());
        hw.put("totalMemory",   formatBytes(runtime.totalMemory()));
        hw.put("maxMemory",     formatBytes(runtime.maxMemory()));
        return hw;
    }

    @Override
    public ServerInfo getServerInfo() {
        return ServerInfo.builder()
                .osName(System.getProperty("os.name")).osVersion(System.getProperty("os.version"))
                .osArchitecture(System.getProperty("os.arch")).hostname(getHostname())
                .manufacturer("Unknown").model("Unknown")
                .kernelVersion(System.getProperty("os.version"))
                .build();
    }

    @Override
    public BiosInfo getBiosInfo() {
        return BiosInfo.builder().vendor("Unknown").version("Unknown").firmwareRevision("Unknown").build();
    }

    @Override
    public Object getOsSpecificInfo() {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("osType",  "Unsupported");
        info.put("warning", "Detailed OS-specific information is not available");
        info.put("systemProperties", getBasicSystemProperties());
        return info;
    }

    private String formatUptime(long seconds) {
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
