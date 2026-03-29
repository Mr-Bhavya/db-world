package com.db.dbworld.app.system.info.dto.os.windows;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class WindowsSecurityInfo {
    private Boolean windowsDefenderEnabled;
    private Boolean firewallEnabled;
    private Boolean uacEnabled;
    private Boolean bitLockerEnabled;
    private Boolean smartScreenEnabled;
    private Boolean secureBootEnabled;
    private List<FirewallProfile> firewallProfiles;
    private List<AntivirusInfo> antivirusProducts;
}
