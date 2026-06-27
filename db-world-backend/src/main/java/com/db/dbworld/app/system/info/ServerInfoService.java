package com.db.dbworld.app.system.info;

import com.db.dbworld.app.system.info.collector.ServerInfoCollector;
import com.db.dbworld.app.system.info.collector.UnsupportedOSCollector;
import com.db.dbworld.app.system.info.collector.linux.LinuxServerInfoCollector;
import com.db.dbworld.app.system.info.collector.linux.RaspberryPiServerInfoCollector;
import com.db.dbworld.app.system.info.collector.windows.WindowsServerInfoCollector;
import com.db.dbworld.app.system.info.dto.*;
import com.db.dbworld.app.system.info.dto.os.linux.LinuxServerInfo;
import com.db.dbworld.app.system.info.dto.os.raspberrypi.RaspberryPiServerInfo;
import com.db.dbworld.app.system.info.dto.os.windows.WindowsServerInfo;
import jakarta.annotation.PostConstruct;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.lang.management.ManagementFactory;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Orchestrates system information collection for all supported OS types.
 * Migrated and enhanced from com.db.dbworld.services.server.ServerInfoService.
 *
 * Selects the correct OS-specific collector at startup; results are cached:
 *  - Full info:  5-second TTL
 *  - Quick info: 1-second TTL
 */
@Log4j2
@Service("appServerInfoService")
public class ServerInfoService {

    private static final DateTimeFormatter FORMATTER     = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final long CACHE_TTL_FULL_MS          = 5_000;
    private static final long CACHE_TTL_QUICK_MS         = 1_000;

    private record CacheEntry<T>(T data, long timestamp) {}

    // AtomicReference for thread-safe cache updates
    private final AtomicReference<CacheEntry<BaseServerInfo>> fullInfoCache  = new AtomicReference<>();
    private final AtomicReference<CacheEntry<BaseServerInfo>> quickInfoCache = new AtomicReference<>();

    private final WindowsServerInfoCollector     windowsCollector;
    private final RaspberryPiServerInfoCollector raspberryPiCollector;
    private final LinuxServerInfoCollector       linuxCollector;
    private final UnsupportedOSCollector         unsupportedOSCollector;

    private final ServerInfoCollector activeCollector;

    @Autowired
    public ServerInfoService(
            @Qualifier("windowsServerInfoCollector")     WindowsServerInfoCollector windowsCollector,
            @Qualifier("raspberryPiServerInfoCollector") RaspberryPiServerInfoCollector raspberryPiCollector,
            @Qualifier("linuxServerInfoCollector")       LinuxServerInfoCollector linuxCollector,
            @Qualifier("unsupportedOSCollector")         UnsupportedOSCollector unsupportedOSCollector) {

        this.windowsCollector      = windowsCollector;
        this.raspberryPiCollector  = raspberryPiCollector;
        this.linuxCollector        = linuxCollector;
        this.unsupportedOSCollector = unsupportedOSCollector;
        this.activeCollector       = detectCollector();
        log.info("ServerInfoService initialized — collector: {}", activeCollector.getClass().getSimpleName());
    }

    @PostConstruct
    void warmupCache() {
        Thread t = new Thread(() -> {
            try { getCachedOrCollect(false); }
            catch (Exception e) { log.debug("Cache warmup non-fatal: {}", e.getMessage()); }
        }, "server-info-warmup");
        t.setDaemon(true);
        t.start();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────────

    /** Full system information (5-second cache). */
    public BaseServerInfo getSystemInfo()      { return getCachedOrCollect(true); }

    /** Quick system metrics (1-second cache). */
    public BaseServerInfo getQuickSystemInfo() { return getCachedOrCollect(false); }

    /** Get a specific data category. */
    public Object getSystemInfoCategory(String category) {
        return switch (category.toLowerCase()) {
            case "cpu"         -> activeCollector.getCpuInfo();
            case "memory"      -> activeCollector.getMemoryInfo();
            case "disk"        -> activeCollector.getDiskInfo();
            case "network"     -> activeCollector.getNetworkInfo();
            case "processes"   -> activeCollector.getRunningProcesses();
            case "services"    -> activeCollector.getRunningServices();
            case "temperature" -> activeCollector.getTemperatureInfo();
            case "hardware"    -> activeCollector.getHardwareDetails();
            case "performance" -> activeCollector.getPerformanceMetrics();
            case "summary"     -> buildSummary();
            default            -> Map.of("error", "Unknown category: " + category);
        };
    }

    /** Per-user CPU/memory process stats (Linux/RPi only). */
    public Object getPerUserProcessStats() {
        if (activeCollector instanceof LinuxServerInfoCollector linux) return linux.getPerUserProcessStats();
        return Map.of("error", "Per-user stats not available on " + activeCollector.getClass().getSimpleName());
    }

    /** Connected USB devices. */
    public Object getUsbDevices() {
        if (activeCollector instanceof LinuxServerInfoCollector linux) return linux.getUsbDevices();
        return List.of();
    }

    /** Connected PCI devices. */
    public Object getPciDevices() {
        if (activeCollector instanceof LinuxServerInfoCollector linux) return linux.getPciDevices();
        return List.of();
    }

    /** Installed packages. */
    public Object getInstalledPackages() {
        if (activeCollector instanceof LinuxServerInfoCollector linux) return linux.getInstalledPackages();
        return List.of();
    }

    /** Open ports & network connections. */
    public Object getOpenPorts() {
        if (activeCollector instanceof LinuxServerInfoCollector linux) return linux.getOpenPorts();
        return List.of();
    }

    /** External/removable drives only. */
    public Object getExternalDrives() {
        DiskInfo disk = activeCollector.getDiskInfo();
        if (disk == null || disk.getDrives() == null) return List.of();
        return disk.getDrives().stream()
                .filter(d -> Boolean.TRUE.equals(d.getRemovable()) || (d.getType() != null && d.getType().startsWith("External")))
                .toList();
    }

    /** OS-specific extended info. */
    public Object getOsSpecificInfo() {
        return activeCollector.getOsSpecificInfo();
    }

    /** Force cache expiry. */
    public void refreshCache() {
        fullInfoCache.set(null);
        quickInfoCache.set(null);
        log.info("System info cache refreshed");
    }

    public int    getHealthScore()          { return Optional.ofNullable(getQuickSystemInfo().getHealthStatus()).map(HealthStatus::getScore).orElse(0); }
    public boolean isSystemHealthy()        { return getHealthScore() >= 70; }
    public String  getActiveCollectorType() { return activeCollector.getClass().getSimpleName(); }

    public long getSystemUptime() {
        BaseServerInfo info = getQuickSystemInfo();
        if (info != null && info.getPerformance() != null && info.getPerformance().getUptimeSeconds() != null) {
            return info.getPerformance().getUptimeSeconds() * 1000L;
        }
        return System.currentTimeMillis() - ManagementFactory.getRuntimeMXBean().getStartTime();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Caching
    // ──────────────────────────────────────────────────────────────────────────

    private BaseServerInfo getCachedOrCollect(boolean full) {
        AtomicReference<CacheEntry<BaseServerInfo>> cacheRef = full ? fullInfoCache : quickInfoCache;
        long ttl   = full ? CACHE_TTL_FULL_MS : CACHE_TTL_QUICK_MS;
        long now   = System.currentTimeMillis();

        CacheEntry<BaseServerInfo> cached = cacheRef.get();
        if (cached != null && (now - cached.timestamp()) < ttl) return cached.data();

        BaseServerInfo result = full ? collectFull() : collectQuick();
        cacheRef.set(new CacheEntry<>(result, now));
        return result;
    }

    private BaseServerInfo collectFull() {
        long start = System.currentTimeMillis();
        try {
            BaseServerInfo result = activeCollector.collect();
            tagOsFlags(result);
            result.setHealthStatus(activeCollector.calculateHealthStatus(result));
            log.info("Full system info collected in {}ms via {}",
                    System.currentTimeMillis() - start, activeCollector.getClass().getSimpleName());
            return result;
        } catch (Exception e) {
            log.error("Error collecting full system info", e);
            return BaseServerInfo.builder().error("Failed: " + e.getMessage()).build();
        }
    }

    private BaseServerInfo collectQuick() {
        try {
            BaseServerInfo result = BaseServerInfo.builder()
                    .serverInfo(ServerInfo.builder()
                            .hostname(activeCollector.getHostname())
                            .osName(System.getProperty("os.name"))
                            .osVersion(System.getProperty("os.version"))
                            .build())
                    .cpu(activeCollector.getBasicCpuInfo())
                    .memory(activeCollector.getBasicMemoryInfo())
                    .performance(activeCollector.getPerformanceMetrics())
                    .build();
            tagOsFlags(result);
            result.setHealthStatus(activeCollector.calculateHealthStatus(result));
            return result;
        } catch (Exception e) {
            log.error("Error collecting quick system info", e);
            return BaseServerInfo.builder().error("Failed: " + e.getMessage()).build();
        }
    }

    private void tagOsFlags(BaseServerInfo info) {
        if (activeCollector instanceof WindowsServerInfoCollector)      { info.setWindows(true); }
        else if (activeCollector instanceof RaspberryPiServerInfoCollector) { info.setLinux(true); info.setRaspberryPi(true); }
        else if (activeCollector instanceof LinuxServerInfoCollector)   { info.setLinux(true); }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // OS detection
    // ──────────────────────────────────────────────────────────────────────────

    private ServerInfoCollector detectCollector() {
        String osName = System.getProperty("os.name", "").toLowerCase();
        log.info("Detecting OS: {}", osName);

        // Raspberry Pi check first (it's Linux but needs vcgencmd)
        if (isRaspberryPi()) {
            log.info("Raspberry Pi detected → raspberryPiCollector");
            return raspberryPiCollector;
        }
        if (osName.contains("windows")) {
            log.info("Windows detected → windowsCollector");
            return windowsCollector;
        }
        if (osName.contains("nix") || osName.contains("nux") || osName.contains("aix")) {
            log.info("Linux detected → linuxCollector");
            return linuxCollector;
        }
        log.warn("Unsupported OS: {} → unsupportedOSCollector", osName);
        return unsupportedOSCollector;
    }

    private boolean isRaspberryPi() {
        try {
            java.nio.file.Path model = java.nio.file.Path.of("/proc/device-tree/model");
            if (java.nio.file.Files.exists(model) &&
                    java.nio.file.Files.readString(model).toLowerCase().contains("raspberry pi")) return true;
            java.nio.file.Path cpuinfo = java.nio.file.Path.of("/proc/cpuinfo");
            if (java.nio.file.Files.exists(cpuinfo)) {
                String info = java.nio.file.Files.readString(cpuinfo).toLowerCase();
                return info.contains("raspberry") || info.contains("bcm2835") ||
                       info.contains("bcm2711") || info.contains("bcm2712");
            }
        } catch (Exception ignored) {}
        return false;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Summary
    // ──────────────────────────────────────────────────────────────────────────

    private Map<String, Object> buildSummary() {
        Map<String, Object> summary = new LinkedHashMap<>();
        BaseServerInfo quick = getQuickSystemInfo();
        summary.put("timestamp",        LocalDateTime.now().format(FORMATTER));
        summary.put("healthScore",      getHealthScore());
        summary.put("isHealthy",        isSystemHealthy());
        summary.put("uptime",           getSystemUptime());
        summary.put("collector",        getActiveCollectorType());
        if (quick.getCpu()        != null) { summary.put("cpuCores", quick.getCpu().getAvailableProcessors()); summary.put("cpuLoad", quick.getCpu().getLoadPercentage()); }
        if (quick.getMemory()     != null)   summary.put("memoryUsedPercent", quick.getMemory().getUsedPercent());
        if (quick.getServerInfo() != null) { summary.put("hostname", quick.getServerInfo().getHostname()); summary.put("os", quick.getServerInfo().getOsName()); }
        if (quick.getPerformance() != null)  summary.put("cpuUsage", quick.getPerformance().getCpuUsagePercent());
        return summary;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Map conversion (backward compat)
    // ──────────────────────────────────────────────────────────────────────────

    public Map<String, Object> getSystemInfoAsMap()      { return convertToMap(getSystemInfo()); }
    public Map<String, Object> getQuickSystemInfoAsMap() { return convertToMap(getQuickSystemInfo()); }

    public Map<String, Object> convertToMap(BaseServerInfo info) {
        Map<String, Object> map = new LinkedHashMap<>();
        if (info == null) return map;
        map.put("windows",     info.isWindows());
        map.put("linux",       info.isLinux());
        map.put("raspberryPi", info.isRaspberryPi());
        map.put("mac",         info.isMac());
        if (info.getServerInfo()   != null) map.put("serverInfo",   info.getServerInfo());
        if (info.getCpu()          != null) map.put("cpu",          info.getCpu());
        if (info.getMemory()       != null) map.put("memory",       info.getMemory());
        if (info.getDisk()         != null) map.put("disk",         info.getDisk());
        if (info.getNetwork()      != null) map.put("network",      info.getNetwork());
        if (info.getProcesses()    != null) map.put("processes",    info.getProcesses());
        if (info.getServices()     != null) map.put("services",     info.getServices());
        if (info.getPerformance()  != null) map.put("performance",  info.getPerformance());
        if (info.getHealthStatus() != null) map.put("healthStatus", info.getHealthStatus());
        if (info.getTemperature()  != null) map.put("temperature",  info.getTemperature());
        if (info.getBiosInfo()     != null) map.put("biosInfo",     info.getBiosInfo());
        if (info.getError()        != null) map.put("error",        info.getError());
        return map;
    }

    public Object getOsSpecificInfo(BaseServerInfo info) {
        if (info instanceof WindowsServerInfo w)     return w.getWindowsInfo();
        if (info instanceof LinuxServerInfo l)       return l.getLinuxInfo();
        if (info instanceof RaspberryPiServerInfo r) return r.getRaspberryPiInfo();
        return null;
    }
}
