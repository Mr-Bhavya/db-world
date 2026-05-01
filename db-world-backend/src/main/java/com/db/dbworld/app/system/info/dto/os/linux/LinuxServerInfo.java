package com.db.dbworld.app.system.info.dto.os.linux;

import com.db.dbworld.app.system.info.dto.BaseServerInfo;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class LinuxServerInfo extends BaseServerInfo {
    private LinuxInfo linuxInfo;
    private List<PackageInfo> installedPackages;
    private List<UserInfo> users;
    private List<CronJob> cronJobs;
    private SystemdInfo systemdInfo;
}
