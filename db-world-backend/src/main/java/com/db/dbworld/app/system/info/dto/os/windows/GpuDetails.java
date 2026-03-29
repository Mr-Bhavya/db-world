package com.db.dbworld.app.system.info.dto.os.windows;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class GpuDetails {
    private String name;
    private String vendor;
    private Long memoryBytes;
    private String memoryFormatted;
    private String driverVersion;
    private String driverDate;
    private String videoProcessor;
    private String resolution;
    private String driverProvider;
}
