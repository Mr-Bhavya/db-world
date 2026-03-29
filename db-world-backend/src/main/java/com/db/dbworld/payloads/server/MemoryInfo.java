package com.db.dbworld.payloads.server;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/** @deprecated Use {@link com.db.dbworld.app.system.info.dto.MemoryInfo} instead. */
@Deprecated(forRemoval = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class MemoryInfo {
    private Long totalBytes;
    private Long freeBytes;
    private Long usedBytes;
    private Long swapTotal;
    private Long swapFree;
    private Long swapUsed;
    // Aliased bytes fields for explicit naming consistency
    private Long swapTotalBytes;
    private Long swapFreeBytes;
    private Long swapUsedBytes;
    private String totalFormatted;
    private String freeFormatted;
    private String usedFormatted;
    private String usedPercent;
    private String availableFormatted;
    private String buffersFormatted;
    private String cachedFormatted;
    private String swapTotalFormatted;
    private String swapFreeFormatted;
    private String swapUsedFormatted;
    private String swapUsedPercent;
    private Long buffers;
    private Long cached;
    private Long shared;
    private Long available;
    private Long javaTotalMemory;
    private Long javaFreeMemory;
    private Long javaMaxMemory;
    private String javaTotalFormatted;
    private String javaFreeFormatted;
    private String javaMaxFormatted;

    private String error;
}
