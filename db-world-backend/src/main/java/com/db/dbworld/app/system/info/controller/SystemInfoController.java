package com.db.dbworld.app.system.info.controller;

import com.db.dbworld.app.system.info.ServerInfoService;
import com.db.dbworld.app.system.info.dto.BaseServerInfo;
import com.db.dbworld.app.system.info.dto.HealthStatus;
import com.db.dbworld.utils.DbWorldConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST API for system / server monitoring.
 * Migrated from com.db.dbworld.controllers.ServerInfoController.
 *
 * All endpoints require at minimum ALL_AUTHORIZE; admin-only endpoints require OWNER_ADMIN_AUTHORIZE.
 */
@Log4j2
@RestController
@RequestMapping("/api/server")
public class SystemInfoController {

    private final ServerInfoService serverInfoService;

    public SystemInfoController(@Qualifier("appServerInfoService") ServerInfoService serverInfoService) {
        this.serverInfoService = serverInfoService;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Full / quick system info
    // ──────────────────────────────────────────────────────────────────────────

    /** Complete system info: CPU, memory, disk, network, processes, services, temperature. */
    @GetMapping("/info")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<?> getSystemInfo(
            @RequestParam(defaultValue = "false") boolean asMap) {
        try {
            BaseServerInfo info = serverInfoService.getSystemInfo();
            return ResponseEntity.ok(asMap ? serverInfoService.convertToMap(info) : info);
        } catch (Exception e) {
            log.error("Error retrieving system info", e);
            return error("Failed to retrieve system information", e);
        }
    }

    /** Quick metrics (CPU, memory, performance) — 1-second cache. */
    @GetMapping("/info/quick")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ResponseEntity<?> getQuickSystemInfo(
            @RequestParam(defaultValue = "false") boolean asMap) {
        try {
            BaseServerInfo info = serverInfoService.getQuickSystemInfo();
            return ResponseEntity.ok(asMap ? serverInfoService.convertToMap(info) : info);
        } catch (Exception e) {
            log.error("Error retrieving quick system info", e);
            return error("Failed to retrieve quick system information", e);
        }
    }

    /** Specific category: cpu | memory | disk | network | processes | services | temperature | hardware | performance | summary */
    @GetMapping("/info/category/{category}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<?> getSystemInfoCategory(@PathVariable String category) {
        try {
            Object info = serverInfoService.getSystemInfoCategory(category);
            if (info instanceof Map<?, ?> m && m.containsKey("error")) {
                return ResponseEntity.badRequest().body(info);
            }
            return ResponseEntity.ok(info);
        } catch (Exception e) {
            log.error("Error retrieving category: {}", category, e);
            return error("Failed to retrieve category: " + category, e);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Live metrics (network speed, per-process, fan/temp)
    // ──────────────────────────────────────────────────────────────────────────

    /** Live network Rx/Tx speed per adapter (1-second delta). */
    @GetMapping("/info/network/live")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ResponseEntity<?> getLiveNetworkSpeed() {
        try {
            return ResponseEntity.ok(serverInfoService.getSystemInfoCategory("network"));
        } catch (Exception e) {
            return error("Failed to retrieve live network speed", e);
        }
    }

    /** Per-user CPU/memory breakdown. */
    @GetMapping("/info/processes/by-user")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<?> getPerUserProcessStats() {
        try {
            return ResponseEntity.ok(serverInfoService.getPerUserProcessStats());
        } catch (Exception e) {
            return error("Failed to retrieve per-user process stats", e);
        }
    }

    /** Temperature sensors and fan speeds. */
    @GetMapping("/info/temperature")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ResponseEntity<?> getTemperatureAndFan() {
        try {
            return ResponseEntity.ok(serverInfoService.getSystemInfoCategory("temperature"));
        } catch (Exception e) {
            return error("Failed to retrieve temperature info", e);
        }
    }

    /** Connected USB devices. */
    @GetMapping("/info/hardware/usb")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<?> getUsbDevices() {
        try {
            return ResponseEntity.ok(serverInfoService.getUsbDevices());
        } catch (Exception e) {
            return error("Failed to retrieve USB devices", e);
        }
    }

    /** Connected PCI devices. */
    @GetMapping("/info/hardware/pci")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<?> getPciDevices() {
        try {
            return ResponseEntity.ok(serverInfoService.getPciDevices());
        } catch (Exception e) {
            return error("Failed to retrieve PCI devices", e);
        }
    }

    /** Installed packages (Debian/Ubuntu: dpkg). */
    @GetMapping("/info/packages")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<?> getInstalledPackages() {
        try {
            return ResponseEntity.ok(serverInfoService.getInstalledPackages());
        } catch (Exception e) {
            return error("Failed to retrieve installed packages", e);
        }
    }

    /** Open ports and active network connections. */
    @GetMapping("/info/network/ports")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<?> getOpenPorts() {
        try {
            return ResponseEntity.ok(serverInfoService.getOpenPorts());
        } catch (Exception e) {
            return error("Failed to retrieve open ports", e);
        }
    }

    /** DMI/BIOS hardware info from /sys/class/dmi/id or dmidecode. */
    @GetMapping("/info/bios")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<?> getBiosInfo() {
        try {
            BaseServerInfo info = serverInfoService.getSystemInfo();
            return ResponseEntity.ok(info.getBiosInfo());
        } catch (Exception e) {
            return error("Failed to retrieve BIOS info", e);
        }
    }

    /** OS-specific extended info (RPi GPIO, Linux distro, Windows features, etc.). */
    @GetMapping("/info/os-specific")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<?> getOsSpecificInfo() {
        try {
            return ResponseEntity.ok(serverInfoService.getOsSpecificInfo());
        } catch (Exception e) {
            return error("Failed to retrieve OS-specific info", e);
        }
    }

    /** External/removable storage only. */
    @GetMapping("/info/disk/external")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ResponseEntity<?> getExternalStorage() {
        try {
            return ResponseEntity.ok(serverInfoService.getExternalDrives());
        } catch (Exception e) {
            return error("Failed to retrieve external storage", e);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Health
    // ──────────────────────────────────────────────────────────────────────────

    @GetMapping("/health")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ResponseEntity<Map<String, Object>> getSystemHealth() {
        try {
            int score       = serverInfoService.getHealthScore();
            boolean healthy = serverInfoService.isSystemHealthy();
            long uptime     = serverInfoService.getSystemUptime();
            HealthStatus hs = serverInfoService.getQuickSystemInfo().getHealthStatus();

            Map<String, Object> result = new HashMap<>();
            result.put("healthScore",      score);
            result.put("isHealthy",        healthy);
            result.put("status",           healthLabel(score));
            result.put("uptimeMs",         uptime);
            result.put("uptimeFormatted",  formatUptime(uptime));
            result.put("collector",        serverInfoService.getActiveCollectorType());
            result.put("timestamp",        Instant.now().toEpochMilli());
            if (hs != null) {
                result.put("level",            hs.getLevel());
                result.put("warnings",         hs.getWarnings());
                result.put("issues",           hs.getIssues());
                result.put("recommendations",  hs.getRecommendations());
            }
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Health endpoint error", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorMap("Health check failed", e));
        }
    }

    @GetMapping("/health/check")
    public ResponseEntity<Void> healthCheck() {
        try {
            return serverInfoService.isSystemHealthy()
                    ? ResponseEntity.ok().build()
                    : ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/health/detailed")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ResponseEntity<HealthStatus> getDetailedHealth() {
        try {
            HealthStatus hs = serverInfoService.getQuickSystemInfo().getHealthStatus();
            if (hs == null) hs = HealthStatus.builder().score(0).level(HealthStatus.HealthLevel.CRITICAL)
                    .timestamp(Instant.now().toEpochMilli()).build();
            return ResponseEntity.ok(hs);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Cache & metadata
    // ──────────────────────────────────────────────────────────────────────────

    @PostMapping("/cache/refresh")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ResponseEntity<Map<String, Object>> refreshCache() {
        try {
            serverInfoService.refreshCache();
            return ResponseEntity.ok(Map.of(
                    "message",   "Cache refreshed",
                    "timestamp", Instant.now().toEpochMilli(),
                    "status",    "success"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorMap("Failed to refresh cache", e));
        }
    }

    @GetMapping("/metadata")
    @PreAuthorize(DbWorldConstants.ALL_AUTHORIZE)
    public ResponseEntity<Map<String, Object>> getMetadata() {
        Map<String, Object> meta = new HashMap<>();
        meta.put("service",   "System Information Service");
        meta.put("version",   "3.0.0");
        meta.put("collector", serverInfoService.getActiveCollectorType());
        meta.put("timestamp", Instant.now().toEpochMilli());
        meta.put("endpoints", Map.ofEntries(
                Map.entry("GET /api/server/info", "Full system info (admin)"),
                Map.entry("GET /api/server/info/quick", "Quick metrics"),
                Map.entry("GET /api/server/info/category/{cat}", "Specific category"),
                Map.entry("GET /api/server/info/network/live", "Live network Rx/Tx speed"),
                Map.entry("GET /api/server/info/processes/by-user", "Per-user CPU/memory"),
                Map.entry("GET /api/server/info/temperature", "Temperature & fan speeds"),
                Map.entry("GET /api/server/info/hardware/usb", "Connected USB devices"),
                Map.entry("GET /api/server/info/hardware/pci", "PCI devices"),
                Map.entry("GET /api/server/info/packages", "Installed packages"),
                Map.entry("GET /api/server/info/network/ports", "Open ports / connections"),
                Map.entry("GET /api/server/info/bios", "BIOS / firmware info"),
                Map.entry("GET /api/server/info/disk/external", "External/removable drives"),
                Map.entry("GET /api/server/info/os-specific", "OS-specific extended info"),
                Map.entry("GET /api/server/health", "Health score & status"),
                Map.entry("GET /api/server/health/check", "Health check (200/503)"),
                Map.entry("GET /api/server/health/detailed", "Detailed health"),
                Map.entry("POST /api/server/cache/refresh", "Refresh cache")
        ));
        meta.put("categories", List.of("cpu","memory","disk","network","processes","services",
                "temperature","hardware","performance","summary"));
        meta.put("cache", Map.of("fullInfoTtl", "5s", "quickInfoTtl", "1s"));
        return ResponseEntity.ok(meta);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private ResponseEntity<Map<String, Object>> error(String msg, Exception e) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorMap(msg, e));
    }

    private Map<String, Object> errorMap(String msg, Exception e) {
        return Map.of("error", msg, "message", e.getMessage(),
                "timestamp", Instant.now().toEpochMilli(), "exception", e.getClass().getSimpleName());
    }

    private String healthLabel(int score) {
        if (score >= 90) return "EXCELLENT";
        if (score >= 80) return "GOOD";
        if (score >= 70) return "FAIR";
        if (score >= 60) return "POOR";
        return "CRITICAL";
    }

    private String formatUptime(long ms) {
        long s = ms / 1000, d = s / 86400, h = (s % 86400) / 3600, m = (s % 3600) / 60;
        return d > 0
                ? String.format("%dd %02dh %02dm", d, h, m)
                : String.format("%02dh %02dm %02ds", h, m, s % 60);
    }
}
