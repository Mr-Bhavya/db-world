package com.db.dbworld.app.system.info.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.system.info.ServerInfoService;
import com.db.dbworld.app.system.info.dto.BaseServerInfo;
import com.db.dbworld.app.system.info.dto.HealthStatus;
import com.db.dbworld.core.role.annotations.AdminAccess;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@Log4j2
@RestController
@RequestMapping("/api/server")
public class SystemInfoController {

    private final ServerInfoService serverInfoService;

    public SystemInfoController(@Qualifier("appServerInfoService") ServerInfoService serverInfoService) {
        this.serverInfoService = serverInfoService;
    }

    /* ── Full system info ─────────────────────────────────────── */

    @AdminAccess
    @GetMapping("/info")
    public ApiResponse<BaseServerInfo> getSystemInfo() {
        return ApiResponse.success(serverInfoService.getSystemInfo());
    }

    /* ── Quick metrics (CPU, memory, performance) ─────────────── */

    @AdminAccess
    @GetMapping("/info/quick")
    public ApiResponse<BaseServerInfo> getQuickSystemInfo() {
        return ApiResponse.success(serverInfoService.getQuickSystemInfo());
    }

    /* ── Category ─────────────────────────────────────────────── */

    @AdminAccess
    @GetMapping("/info/category/{category}")
    public ApiResponse<Object> getSystemInfoCategory(@PathVariable String category) {
        return ApiResponse.success(serverInfoService.getSystemInfoCategory(category));
    }

    /* ── Live network Rx/Tx ───────────────────────────────────── */

    @AdminAccess
    @GetMapping("/info/network/live")
    public ApiResponse<Object> getLiveNetworkSpeed() {
        return ApiResponse.success(serverInfoService.getSystemInfoCategory("network"));
    }

    /* ── Per-user process breakdown ───────────────────────────── */

    @AdminAccess
    @GetMapping("/info/processes/by-user")
    public ApiResponse<Object> getPerUserProcessStats() {
        return ApiResponse.success(serverInfoService.getPerUserProcessStats());
    }

    /* ── Temperature & fans ───────────────────────────────────── */

    @AdminAccess
    @GetMapping("/info/temperature")
    public ApiResponse<Object> getTemperatureAndFan() {
        return ApiResponse.success(serverInfoService.getSystemInfoCategory("temperature"));
    }

    /* ── USB devices ──────────────────────────────────────────── */

    @AdminAccess
    @GetMapping("/info/hardware/usb")
    public ApiResponse<Object> getUsbDevices() {
        return ApiResponse.success(serverInfoService.getUsbDevices());
    }

    /* ── PCI devices ──────────────────────────────────────────── */

    @AdminAccess
    @GetMapping("/info/hardware/pci")
    public ApiResponse<Object> getPciDevices() {
        return ApiResponse.success(serverInfoService.getPciDevices());
    }

    /* ── Installed packages ───────────────────────────────────── */

    @AdminAccess
    @GetMapping("/info/packages")
    public ApiResponse<Object> getInstalledPackages() {
        return ApiResponse.success(serverInfoService.getInstalledPackages());
    }

    /* ── Open ports ───────────────────────────────────────────── */

    @AdminAccess
    @GetMapping("/info/network/ports")
    public ApiResponse<Object> getOpenPorts() {
        return ApiResponse.success(serverInfoService.getOpenPorts());
    }

    /* ── BIOS info ────────────────────────────────────────────── */

    @AdminAccess
    @GetMapping("/info/bios")
    public ApiResponse<Object> getBiosInfo() {
        return ApiResponse.success(serverInfoService.getSystemInfo().getBiosInfo());
    }

    /* ── OS-specific extended info ────────────────────────────── */

    @AdminAccess
    @GetMapping("/info/os-specific")
    public ApiResponse<Object> getOsSpecificInfo() {
        return ApiResponse.success(serverInfoService.getOsSpecificInfo());
    }

    /* ── External / removable storage ────────────────────────── */

    @AdminAccess
    @GetMapping("/info/disk/external")
    public ApiResponse<Object> getExternalStorage() {
        return ApiResponse.success(serverInfoService.getExternalDrives());
    }

    /* ── Health summary ───────────────────────────────────────── */

    @AdminAccess
    @GetMapping("/health")
    public ApiResponse<HealthStatus> getSystemHealth() {
        HealthStatus hs = serverInfoService.getQuickSystemInfo().getHealthStatus();
        if (hs == null) {
            int score = serverInfoService.getHealthScore();
            hs = HealthStatus.builder()
                    .score(score)
                    .level(score >= 70
                            ? HealthStatus.HealthLevel.GOOD
                            : HealthStatus.HealthLevel.CRITICAL)
                    .timestamp(Instant.now().toEpochMilli())
                    .build();
        }
        return ApiResponse.success(hs);
    }

    /* ── Health check — raw 200/503 for monitoring tools ─────── */

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

    /* ── Detailed health ──────────────────────────────────────── */

    @AdminAccess
    @GetMapping("/health/detailed")
    public ApiResponse<HealthStatus> getDetailedHealth() {
        HealthStatus hs = serverInfoService.getQuickSystemInfo().getHealthStatus();
        if (hs == null) {
            hs = HealthStatus.builder()
                    .score(0)
                    .level(HealthStatus.HealthLevel.CRITICAL)
                    .timestamp(Instant.now().toEpochMilli())
                    .build();
        }
        return ApiResponse.success(hs);
    }

    /* ── Cache refresh ────────────────────────────────────────── */

    @AdminAccess
    @PostMapping("/cache/refresh")
    public ApiResponse<Void> refreshCache() {
        serverInfoService.refreshCache();
        return ApiResponse.success("Cache refreshed");
    }
}
