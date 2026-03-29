package com.db.dbworld.app.system.info.dto.os.windows;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class WindowsInfo {
    private String edition;
    private String buildNumber;
    private String installDate;
    private String registeredOwner;
    private String registeredOrganization;
    private String productId;
    private String productKey;
    private String timeZone;
    private String locale;
    private String countryCode;
    private String systemDirectory;
    private String windowsDirectory;
    private String deviceGuardStatus;
}
