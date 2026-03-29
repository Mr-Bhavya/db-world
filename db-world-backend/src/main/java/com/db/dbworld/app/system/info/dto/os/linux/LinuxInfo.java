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
public class LinuxInfo {
    private String distribution;
    private String distributionVersion;
    private String kernelVersion;
    private String desktopEnvironment;
    private String displayManager;
    private String packageManager;
    private Long lastUpdate;
    private List<String> repositories;
    private String shell;
    private String locale;
    private String selinuxStatus;
    private String apparmorStatus;
    private String compilerVersion;
}
