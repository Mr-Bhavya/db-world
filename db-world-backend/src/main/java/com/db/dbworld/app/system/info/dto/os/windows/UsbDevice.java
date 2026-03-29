package com.db.dbworld.app.system.info.dto.os.windows;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class UsbDevice {
    private String name;
    private String manufacturer;
    private String deviceId;
    private String description;
    private String driverVersion;
}
