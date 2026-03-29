package com.db.dbworld.app.system.info.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class MemoryInfo {
    // Physical RAM
    private Long totalBytes;
    private Long freeBytes;
    private Long usedBytes;
    private Long availableBytes;
    private Long buffersBytes;
    private Long cachedBytes;
    private Long sharedBytes;

    // Swap
    private Long swapTotalBytes;
    private Long swapFreeBytes;
    private Long swapUsedBytes;

    // Formatted strings
    private String totalFormatted;
    private String freeFormatted;
    private String usedFormatted;
    private String availableFormatted;
    private String buffersFormatted;
    private String cachedFormatted;
    private String swapTotalFormatted;
    private String swapFreeFormatted;
    private String swapUsedFormatted;

    // Percentages
    private String usedPercent;
    private String swapUsedPercent;

    // JVM heap (informational)
    private Long javaTotalMemory;
    private Long javaFreeMemory;
    private Long javaMaxMemory;
    private String javaTotalFormatted;
    private String javaFreeFormatted;
    private String javaMaxFormatted;

    private String error;
}
