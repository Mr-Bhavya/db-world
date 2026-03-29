package com.db.dbworld.app.system.info.dto;

import com.db.dbworld.app.system.info.dto.os.linux.LinuxServerInfo;
import com.db.dbworld.app.system.info.dto.os.raspberrypi.RaspberryPiServerInfo;
import com.db.dbworld.app.system.info.dto.os.windows.WindowsServerInfo;
import lombok.experimental.UtilityClass;

@UtilityClass
public class ServerInfoFactory {

    public static BaseServerInfo create(String osType, boolean isRaspberryPi) {
        if (isRaspberryPi) {
            return RaspberryPiServerInfo.builder()
                    .raspberryPi(true)
                    .linux(true)
                    .build();
        }

        return switch (osType.toLowerCase()) {
            case "windows" -> WindowsServerInfo.builder().windows(true).build();
            case "linux"   -> LinuxServerInfo.builder().linux(true).build();
            default        -> BaseServerInfo.builder().build();
        };
    }
}
