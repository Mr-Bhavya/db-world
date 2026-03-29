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
public class CpuInfo {
    private String name;
    private String vendor;
    /** Total physical core count. */
    private Integer cores;
    private Integer threads;
    private Long maxFrequency;
    private Long currentFrequency;
    /** Clock speed in MHz (may differ from max/current frequency). */
    private Double clockSpeedMhz;
    private String architecture;
    /** Overall load percentage as integer (0-100). */
    private Integer loadPercentage;
    /** Overall load percentage as formatted string, e.g. "42.5%". */
    private String loadPercentageStr;
    private Integer availableProcessors;
    private Long l1Cache;
    private Long l2Cache;
    private Long l3Cache;
    /** Human-readable cache size, e.g. "8 MB". */
    private String cacheSize;
    /** Per-core breakdown. */
    private List<CpuCore> coreDetails;
    private String error;
}
