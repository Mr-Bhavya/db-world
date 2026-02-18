package com.db.dbworld.payloads.server;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

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
    private String totalFormatted;
    private String freeFormatted;
    private String usedFormatted;
    private String usedPercent;
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
