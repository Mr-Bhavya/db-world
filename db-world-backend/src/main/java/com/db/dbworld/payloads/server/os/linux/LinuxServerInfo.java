package com.db.dbworld.payloads.server.os.linux;

import com.db.dbworld.payloads.server.BaseServerInfo;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import java.util.List;

@Data
@SuperBuilder
@EqualsAndHashCode(callSuper = true)
public class LinuxServerInfo extends BaseServerInfo {
    private LinuxInfo linuxInfo;
    private List<PackageInfo> installedPackages;
    private List<UserInfo> users;
    private List<CronJob> cronJobs;
    private SystemdInfo systemdInfo;
}

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
class LinuxInfo {
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

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
class PackageInfo {
    private String name;
    private String version;
    private String architecture;
    private String repository;
    private Long size;
    private String description;
    private String maintainer;
    private Long installDate;
    private String section;
}

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
class UserInfo {
    private String username;
    private String uid;
    private String gid;
    private String home;
    private String shell;
    private List<String> groups;
    private Long lastLogin;
    private Boolean locked;
    private Boolean passwordExpired;
    private String realName;
}

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
class CronJob {
    private String user;
    private String schedule;
    private String command;
    private String comment;
    private String environment;
}

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
class SystemdInfo {
    private List<SystemdUnit> units;
    private Integer failedUnits;
    private String systemdVersion;
    private String defaultTarget;
    private Boolean systemdRunning;
}

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
class SystemdUnit {
    private String name;
    private String loadState;
    private String activeState;
    private String subState;
    private String description;
    private String mainPid;
    private Long memoryCurrent;
}