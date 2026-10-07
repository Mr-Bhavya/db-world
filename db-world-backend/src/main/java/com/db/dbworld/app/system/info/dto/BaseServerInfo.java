package com.db.dbworld.app.system.info.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class BaseServerInfo {
    private boolean windows;
    private boolean linux;
    private boolean raspberryPi;
    private boolean mac;
    private ServerInfo serverInfo;
    private BiosInfo biosInfo;
    private CpuInfo cpu;
    private MemoryInfo memory;
    private DiskInfo disk;
    private NetworkInfo network;
    private List<ProcessInfo> processes;
    private List<ServiceInfo> services;
    private PerformanceMetrics performance;
    private HealthStatus healthStatus;
    private TemperatureInfo temperature;
    private String error;

    /**
     * When the host data in this reading was captured, as an ISO-8601 instant
     * ({@code 2026-10-07T18:00:00Z}). Set only when the backend runs in a container and answered
     * the host's commands and files from the host's snapshot, which is up to a minute old; null
     * when it ran them itself. /proc and /sys figures (CPU, memory, network) are live either way.
     */
    private String hostSnapshotAt;
}
