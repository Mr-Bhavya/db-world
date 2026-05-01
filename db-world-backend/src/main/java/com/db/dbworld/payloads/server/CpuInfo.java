package com.db.dbworld.payloads.server;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;

/** @deprecated Use {@link com.db.dbworld.app.system.info.dto.CpuInfo} instead. */
@Deprecated(forRemoval = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class CpuInfo {
    private String name;
    private String vendor;
    private Integer noOfCores;
    private Integer cores;
    private Integer threads;
    private Long maxFrequency;
    private Long currentFrequency;
    private Double clockSpeedMhz;
    private String architecture;
    private Integer loadPercentage;
    private String loadPercentageStr;
    private Integer availableProcessors;
    private Long l1Cache;
    private Long l2Cache;
    private Long l3Cache;
    private String cacheSize;
    private List<CpuCore> coreDetails;

    private String error;
}
