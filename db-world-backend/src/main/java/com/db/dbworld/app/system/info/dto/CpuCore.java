package com.db.dbworld.app.system.info.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class CpuCore {
    private Integer coreId;
    private Long frequency;
    private Double loadPercent;
    private String vendor;
}
