package com.db.dbworld.app.system.info.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class PerformanceMetrics {
    private Double cpuLoad1Min;
    private Double cpuLoad5Min;
    private Double cpuLoad15Min;
    /** Aggregate CPU usage percent (0-100) from /proc/stat delta. */
    private Double cpuUsagePercent;
    private Double memoryLoadPercent;
    private Double diskIOLoad;
    private Integer processCount;
    private Integer runningProcessCount;
    private Integer threadCount;
    private String uptime;
    private Long uptimeSeconds;
    private Long contextSwitches;
    private Long interrupts;
    private Long pageFaults;
    private Long diskReads;
    private Long diskWrites;
    private Long networkBytesIn;
    private Long networkBytesOut;
}
