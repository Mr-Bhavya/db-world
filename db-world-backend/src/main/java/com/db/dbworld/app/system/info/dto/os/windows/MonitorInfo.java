package com.db.dbworld.app.system.info.dto.os.windows;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class MonitorInfo {
    private String manufacturer;
    private String name;
    private String serial;
    private String resolution;
    private String refreshRate;
    private String displayTechnology;
}
