package com.db.dbworld.payloads.server.os.windows;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class AudioDevice {
    private String name;
    private String manufacturer;
    private String status;
    private Boolean isDefault;
    private String driverVersion;
}
