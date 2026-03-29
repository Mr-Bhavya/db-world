package com.db.dbworld.payloads.server;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/** @deprecated Use {@link com.db.dbworld.app.system.info.dto.PerformanceMetrics} instead. */
@Deprecated(forRemoval = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class PerformanceMetrics {
    private Double cpuLoad1Min;
    private Double cpuLoad5Min;
    private Double cpuLoad15Min;
    private Double memoryLoadPercent;
    private Double diskIOLoad;
    private Integer processCount;
    private Integer threadCount;
    private String uptime;
    private Long contextSwitches;
    private Long interrupts;
    private Long pageFaults;
    private Long diskReads;
    private Long diskWrites;
    private Long networkBytesIn;
    private Long networkBytesOut;
    private Long uptimeSeconds;
    private Double cpuUsagePercent;
    private Integer runningProcessCount;
}
