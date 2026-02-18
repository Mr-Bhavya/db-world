package com.db.dbworld.payloads.server;

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
    private Integer load;
    private String vendor;
}
