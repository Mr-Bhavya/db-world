package com.db.dbworld.app.system.info.dto.os.linux;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SystemdInfo {
    private List<SystemdUnit> units;
    private Integer failedUnits;
    private String systemdVersion;
    private String defaultTarget;
    private Boolean systemdRunning;
}
