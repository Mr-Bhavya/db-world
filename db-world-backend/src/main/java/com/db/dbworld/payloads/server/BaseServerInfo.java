package com.db.dbworld.payloads.server;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import java.util.List;

/** @deprecated Use {@link com.db.dbworld.app.system.info.dto.BaseServerInfo} instead. */
@Deprecated(forRemoval = true)
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
}

