package com.db.dbworld.payloads.server;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/** @deprecated Use {@link com.db.dbworld.app.system.info.dto.CpuCore} instead. */
@Deprecated(forRemoval = true)
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
