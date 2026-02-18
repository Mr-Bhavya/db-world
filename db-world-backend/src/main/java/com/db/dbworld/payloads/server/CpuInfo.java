package com.db.dbworld.payloads.server;

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
    private Integer noOfCores;
    private Integer threads;
    private Long maxFrequency;
    private Long currentFrequency;
    private String architecture;
    private Integer loadPercentage;
    private Integer availableProcessors;
    private Long l1Cache;
    private Long l2Cache;
    private Long l3Cache;
    private List<CpuCore> cores;

    private String error;
}
