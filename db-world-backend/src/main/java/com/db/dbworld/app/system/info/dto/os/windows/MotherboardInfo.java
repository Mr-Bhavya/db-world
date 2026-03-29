package com.db.dbworld.app.system.info.dto.os.windows;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class MotherboardInfo {
    private String manufacturer;
    private String product;
    private String serial;
    private String version;
    private String biosVersion;
    private String biosDate;
}
