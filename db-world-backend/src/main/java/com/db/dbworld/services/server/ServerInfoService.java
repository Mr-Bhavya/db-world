package com.db.dbworld.services.server;

import com.db.dbworld.payloads.server.*;
import com.db.dbworld.payloads.server.os.linux.LinuxServerInfo;
import com.db.dbworld.payloads.server.os.mac.MacServerInfo;
import com.db.dbworld.payloads.server.os.raspberrypi.RaspberryPiServerInfo;
import com.db.dbworld.payloads.server.os.windows.WindowsServerInfo;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.lang.management.ManagementFactory;
import java.lang.management.RuntimeMXBean;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Main service class that orchestrates system information collection.
 */
@Log4j2
@Service
public class ServerInfoService {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final long CACHE_TTL_MS = 5000; // 5 seconds cache
    private static final long CACHE_TTL_MS_FAST = 1000; // 1 second for fast-changing metrics

    private record CacheEntry<T>(T data, long timestamp, String cacheType) {
        private CacheEntry(T data, long timestamp, String cacheType) {
            this.data = data;
            this.timestamp = timestamp;
            this.cacheType = cacheType;
        }
    }

    private CacheEntry<BaseServerInfo> fullInfoCache;
    private CacheEntry<BaseServerInfo> quickInfoCache;

    private final WindowsServerInfoCollector windowsCollector;
    //    private final LinuxServerInfoCollector linuxCollector;
    private final RaspberryPiServerInfoCollector raspberryPiCollector;
    //    private final MacServerInfoCollector macCollector;
    private final UnsupportedOSCollector unsupportedOSCollector;

    private final ServerInfoCollector activeCollector;

    /**
     * Constructor with explicit collector injection.
     */
    @Autowired
    public ServerInfoService(
            @Qualifier("windowsServerInfoCollector") WindowsServerInfoCollector windowsCollector,
//            @Qualifier("linuxCollector") LinuxServerInfoCollector linuxCollector,
            @Qualifier("raspberryPiServerInfoCollector") RaspberryPiServerInfoCollector raspberryPiCollector,
//            @Qualifier("macCollector") MacServerInfoCollector macCollector,
            @Qualifier("unsupportedOSCollector") UnsupportedOSCollector unsupportedOSCollector) {

        this.windowsCollector = windowsCollector;
//        this.linuxCollector = linuxCollector;
        this.raspberryPiCollector = raspberryPiCollector;
//        this.macCollector = macCollector;
        this.unsupportedOSCollector = unsupportedOSCollector;

        // Detect OS and set active collector
        this.activeCollector = detectAndSetCollector();
        log.info("ServerInfoService initialized with collector: {}",
                activeCollector.getClass().getSimpleName());
    }

    /**
     * Main method to get complete system information.
     */
    public BaseServerInfo getSystemInfo() {
        return getCachedOrCollect("full", CACHE_TTL_MS);
    }

    /**
     * Get quick system information (basic metrics only).
     */
    public BaseServerInfo getQuickSystemInfo() {
        return getCachedOrCollect("quick", CACHE_TTL_MS_FAST);
    }

    /**
     * Get specific category of system information.
     */
    public Object getSystemInfoCategory(String category) {
        return switch (category.toLowerCase()) {
            case "cpu" -> getCpuInfo();
            case "memory" -> getMemoryInfo();
            case "disk" -> getDiskInfo();
            case "network" -> getNetworkInfo();
            case "processes" -> getProcessesInfo();
            case "services" -> getServicesInfo();
            case "temperature" -> getTemperatureInfo();
            case "hardware" -> getHardwareInfo();
            case "performance" -> getPerformanceInfo();
            case "summary" -> getSummaryInfo();
            default -> Collections.singletonMap("error", "Unknown category: " + category);
        };
    }

    /**
     * Force refresh of system information cache.
     */
    public void refreshCache() {
        fullInfoCache = null;
        quickInfoCache = null;
        log.info("System info cache refreshed");
    }

    /**
     * Get system health score (0-100).
     */
    public int getHealthScore() {
        BaseServerInfo info = getQuickSystemInfo();
        if (info != null && info.getHealthStatus() != null) {
            return info.getHealthStatus().getScore();
        }
        return 0;
    }

    /**
     * Check if system is healthy (score >= 70).
     */
    public boolean isSystemHealthy() {
        return getHealthScore() >= 70;
    }

    /* ============================================
       PRIVATE IMPLEMENTATION METHODS
       ============================================ */

    private BaseServerInfo getCachedOrCollect(String cacheType, long ttl) {
        long currentTime = System.currentTimeMillis();
        CacheEntry<BaseServerInfo> cache = cacheType.equals("full") ? fullInfoCache : quickInfoCache;

        // Check cache validity
        if (cache != null && (currentTime - cache.timestamp) < ttl) {
            log.debug("Returning cached {} system info (age: {}ms)",
                    cacheType, currentTime - cache.timestamp);
            return cache.data;
        }

        // Collect fresh data
        BaseServerInfo result = cacheType.equals("full")
                ? collectFullSystemInfo()
                : collectQuickSystemInfo();

        // Update cache
        CacheEntry<BaseServerInfo> newCache = new CacheEntry<>(result, currentTime, cacheType);
        if (cacheType.equals("full")) {
            fullInfoCache = newCache;
        } else {
            quickInfoCache = newCache;
        }

        log.debug("Collected fresh {} system info", cacheType);
        return result;
    }

    private BaseServerInfo collectFullSystemInfo() {
        long startTime = System.currentTimeMillis();
        BaseServerInfo result;

        try {
            // Collect OS-specific data using active collector
            result = activeCollector.collect();

            // Set OS flags based on collector type
            if (activeCollector instanceof WindowsServerInfoCollector) {
                result.setWindows(true);
            } else if (activeCollector instanceof RaspberryPiServerInfoCollector) {
                result.setLinux(true);
                result.setRaspberryPi(true);
            }

            // Calculate health status
            HealthStatus healthStatus = activeCollector.calculateHealthStatus(result);
            result.setHealthStatus(healthStatus);

            // Add collection metadata
            addCollectionMetadata(result, startTime);

            // Log successful collection
            log.info("Successfully collected full system info using {} collector",
                    activeCollector.getClass().getSimpleName());

        } catch (Exception e) {
            log.error("Error collecting full system information with collector: {}",
                    activeCollector.getClass().getSimpleName(), e);
            result = BaseServerInfo.builder()
                    .error("Failed to collect system info: " + e.getMessage())
                    .build();
        }

        return result;
    }

    private BaseServerInfo collectQuickSystemInfo() {
        long startTime = System.currentTimeMillis();
        BaseServerInfo result;

        try {
            // Quick collection - only essential metrics
            result = BaseServerInfo.builder()
                    .serverInfo(ServerInfo.builder()
                            .hostname(activeCollector.getHostname())
                            .osName(System.getProperty("os.name"))
                            .osVersion(System.getProperty("os.version"))
                            .build())
                    .cpu(activeCollector.getBasicCpuInfo())
                    .memory(activeCollector.getBasicMemoryInfo())
                    .performance(activeCollector.getPerformanceMetrics())
                    .build();

            // Calculate quick health status
            HealthStatus healthStatus = activeCollector.calculateHealthStatus(result);
            result.setHealthStatus(healthStatus);

            // Add collection metadata
            addCollectionMetadata(result, startTime);

        } catch (Exception e) {
            log.error("Error collecting quick system information", e);
            result = BaseServerInfo.builder()
                    .error("Failed to collect quick system info: " + e.getMessage())
                    .build();
        }

        return result;
    }

    private void addCollectionMetadata(BaseServerInfo result, long startTime) {
        // Create metadata map
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("collectionTimestamp", LocalDateTime.now().format(FORMATTER));
        metadata.put("collectionDuration", System.currentTimeMillis() - startTime);
        metadata.put("collectorType", activeCollector.getClass().getSimpleName());
        metadata.put("collectionId", UUID.randomUUID().toString());
        metadata.put("osName", System.getProperty("os.name"));
        metadata.put("osVersion", System.getProperty("os.version"));
        metadata.put("osArch", System.getProperty("os.arch"));

        // You can store metadata in result if you add a metadata field to BaseServerInfo
        // For now, we'll log it
        log.debug("Collection metadata: {}", metadata);
    }

    /* ============================================
       CATEGORY-SPECIFIC METHODS
       ============================================ */

    private CpuInfo getCpuInfo() {
        return activeCollector.getCpuInfo();
    }

    private MemoryInfo getMemoryInfo() {
        return activeCollector.getMemoryInfo();
    }

    private DiskInfo getDiskInfo() {
        return activeCollector.getDiskInfo();
    }

    private NetworkInfo getNetworkInfo() {
        return activeCollector.getNetworkInfo();
    }

    private List<ProcessInfo> getProcessesInfo() {
        return activeCollector.getRunningProcesses();
    }

    private List<ServiceInfo> getServicesInfo() {
        return activeCollector.getRunningServices();
    }

    private TemperatureInfo getTemperatureInfo() {
        return activeCollector.getTemperatureInfo();
    }

    private Object getHardwareInfo() {
        return activeCollector.getHardwareDetails();
    }

    private PerformanceMetrics getPerformanceInfo() {
        return activeCollector.getPerformanceMetrics();
    }

    private Map<String, Object> getSummaryInfo() {
        Map<String, Object> summary = new LinkedHashMap<>();
        BaseServerInfo quickInfo = getQuickSystemInfo();

        summary.put("timestamp", LocalDateTime.now().format(FORMATTER));
        summary.put("healthScore", getHealthScore());
        summary.put("isHealthy", isSystemHealthy());
        summary.put("uptime", getSystemUptime());

        if (quickInfo.getCpu() != null) {
            summary.put("cpuCores", quickInfo.getCpu().getCores());
            summary.put("cpuLoad", quickInfo.getCpu().getLoadPercentage());
        }

        if (quickInfo.getMemory() != null) {
            summary.put("memoryUsedPercent", quickInfo.getMemory().getUsedPercent());
        }

        if (quickInfo.getServerInfo() != null) {
            summary.put("hostname", quickInfo.getServerInfo().getHostname());
            summary.put("os", quickInfo.getServerInfo().getOsName() + " " + quickInfo.getServerInfo().getOsVersion());
        }

        return summary;
    }

    /* ============================================
       OS DETECTION METHODS
       ============================================ */

    private ServerInfoCollector detectAndSetCollector() {
        String osName = System.getProperty("os.name", "").toLowerCase();
        log.info("Detected OS: {}", osName);

        // First check for Raspberry Pi (most specific)
        if (isRaspberryPi()) {
            log.info("Raspberry Pi detected, using RaspberryPiCollector");
            return raspberryPiCollector;
        }

        // Check for Linux (including Raspberry Pi OS)
//        if (osName.contains("linux")) {
//            log.info("Linux detected, using LinuxCollector");
//            return linuxCollector;
//        }

        // Check for Windows
        if (osName.contains("windows")) {
            log.info("Windows detected, using WindowsCollector");
            return windowsCollector;
        }

        // Check for macOS
//        if (osName.contains("mac")) {
//            log.info("macOS detected, using MacCollector");
//            return macCollector;
//        }

        // Default to unsupported
        log.warn("Unsupported OS detected: {}, using UnsupportedOSCollector", osName);
        return unsupportedOSCollector;
    }

    private boolean isRaspberryPi() {
        try {
            // Method 1: Check /proc/device-tree/model
            java.nio.file.Path modelPath = java.nio.file.Paths.get("/proc/device-tree/model");
            if (java.nio.file.Files.exists(modelPath)) {
                String model = java.nio.file.Files.readString(modelPath).toLowerCase();
                log.debug("Device tree model: {}", model);
                if (model.contains("raspberry pi")) {
                    return true;
                }
            }

            // Method 2: Check CPU info
            java.nio.file.Path cpuinfoPath = java.nio.file.Paths.get("/proc/cpuinfo");
            if (java.nio.file.Files.exists(cpuinfoPath)) {
                String cpuinfo = java.nio.file.Files.readString(cpuinfoPath).toLowerCase();
                log.debug("CPU info check for Raspberry Pi");
                if (cpuinfo.contains("raspberry") ||
                        cpuinfo.contains("bcm2835") ||
                        cpuinfo.contains("bcm2836") ||
                        cpuinfo.contains("bcm2837") ||
                        cpuinfo.contains("bcm2711") ||
                        cpuinfo.contains("bcm2712")) {
                    return true;
                }
            }

            // Method 3: Check if raspberrypi hostname
            String hostname = activeCollector.getHostname();
            if (hostname.toLowerCase().contains("raspberrypi")) {
                return true;
            }

            // Method 4: Check for Raspberry Pi specific files
            java.nio.file.Path configPath = java.nio.file.Paths.get("/boot/config.txt");
            if (java.nio.file.Files.exists(configPath)) {
                // Check for Raspberry Pi specific config
                String config = java.nio.file.Files.readString(configPath);
                return config.contains("arm_freq") || config.contains("gpu_mem") || config.contains("start_x");
            }

            return false;

        } catch (Exception e) {
            log.debug("Error checking Raspberry Pi: {}", e.getMessage());
            return false;
        }
    }

    private String getQuickUptime() {
        try {
            // Try to get system uptime
            String uptime = activeCollector.exec("uptime");
            if (!uptime.isEmpty()) {
                return uptime;
            }
        } catch (Exception e) {
            log.debug("Error getting uptime", e);
        }

        // Fallback to JVM uptime
        RuntimeMXBean rb = ManagementFactory.getRuntimeMXBean();
        long uptime = rb.getUptime();
        long days = uptime / (1000 * 60 * 60 * 24);
        long hours = (uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60);
        long minutes = (uptime % (1000 * 60 * 60)) / (1000 * 60);

        if (days > 0) {
            return String.format("%d days, %d hours, %d minutes", days, hours, minutes);
        } else if (hours > 0) {
            return String.format("%d hours, %d minutes", hours, minutes);
        } else {
            return String.format("%d minutes", minutes);
        }
    }

    /**
     * Get system uptime in milliseconds.
     */
    public long getSystemUptime() {
        BaseServerInfo info = getQuickSystemInfo();
        if (info != null && info.getServerInfo() != null && info.getServerInfo().getUptime() != null) {
            try {
                // Parse uptime string if needed, or use performance metrics
                if (info.getPerformance() != null && info.getPerformance().getUptimeSeconds() != null) {
                    return info.getPerformance().getUptimeSeconds() * 1000L;
                }
            } catch (Exception e) {
                log.debug("Error parsing uptime", e);
            }
        }
        return System.currentTimeMillis() - ManagementFactory.getRuntimeMXBean().getStartTime();
    }

    /**
     * Helper method to convert BaseServerInfo to Map for backward compatibility
     */
    public Map<String, Object> convertToMap(BaseServerInfo info) {
        Map<String, Object> map = new LinkedHashMap<>();

        if (info == null) {
            return map;
        }

        map.put("windows", info.isWindows());
        map.put("linux", info.isLinux());
        map.put("raspberryPi", info.isRaspberryPi());
        map.put("mac", info.isMac());

        if (info.getServerInfo() != null) {
            map.put("serverInfo", convertServerInfoToMap(info.getServerInfo()));
        }

        if (info.getCpu() != null) {
            map.put("cpu", info.getCpu());
        }

        if (info.getMemory() != null) {
            map.put("memory", info.getMemory());
        }

        if (info.getDisk() != null) {
            map.put("disk", info.getDisk());
        }

        if (info.getNetwork() != null) {
            map.put("network", info.getNetwork());
        }

        if (info.getProcesses() != null) {
            map.put("processes", info.getProcesses());
        }

        if (info.getServices() != null) {
            map.put("services", info.getServices());
        }

        if (info.getPerformance() != null) {
            map.put("performance", info.getPerformance());
        }

        if (info.getHealthStatus() != null) {
            map.put("healthStatus", info.getHealthStatus());
        }

        if (info.getTemperature() != null) {
            map.put("temperature", info.getTemperature());
        }

        if (info.getError() != null) {
            map.put("error", info.getError());
        }

        return map;
    }

    private Map<String, Object> convertServerInfoToMap(ServerInfo serverInfo) {
        Map<String, Object> map = new HashMap<>();
        map.put("osName", serverInfo.getOsName());
        map.put("osVersion", serverInfo.getOsVersion());
        map.put("osArchitecture", serverInfo.getOsArchitecture());
        map.put("hostname", serverInfo.getHostname());
        map.put("manufacturer", serverInfo.getManufacturer());
        map.put("model", serverInfo.getModel());
        map.put("serialNumber", serverInfo.getSerialNumber());
        map.put("uptime", serverInfo.getUptime());
        map.put("bootTime", serverInfo.getBootTime());
        map.put("kernelVersion", serverInfo.getKernelVersion());
        map.put("distribution", serverInfo.getDistribution());
        map.put("distributionVersion", serverInfo.getDistributionVersion());
        map.put("desktopEnvironment", serverInfo.getDesktopEnvironment());
        return map;
    }

    /**
     * Get OS-specific information if available
     */
    public Object getOsSpecificInfo(BaseServerInfo info) {
        if (info instanceof WindowsServerInfo windowsInfo) {
            return windowsInfo.getWindowsInfo();
        } else if (info instanceof LinuxServerInfo linuxInfo) {
            return linuxInfo.getLinuxInfo();
        } else if (info instanceof RaspberryPiServerInfo rpiInfo) {
            return rpiInfo.getRaspberryPiInfo();
        } else if (info instanceof MacServerInfo macInfo) {
            return macInfo.getMacInfo();
        }
        return null;
    }

    /**
     * Get complete system info as Map (for backward compatibility)
     */
    public Map<String, Object> getSystemInfoAsMap() {
        BaseServerInfo info = getSystemInfo();
        return convertToMap(info);
    }

    /**
     * Get quick system info as Map (for backward compatibility)
     */
    public Map<String, Object> getQuickSystemInfoAsMap() {
        BaseServerInfo info = getQuickSystemInfo();
        return convertToMap(info);
    }

    /**
     * Get the currently active collector (for debugging)
     */
    public String getActiveCollectorType() {
        return activeCollector.getClass().getSimpleName();
    }
}