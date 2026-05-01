package com.db.dbworld.payloads.server;

import com.db.dbworld.payloads.server.os.linux.LinuxServerInfo;
import com.db.dbworld.payloads.server.os.mac.MacServerInfo;
import com.db.dbworld.payloads.server.os.raspberrypi.RaspberryPiServerInfo;
import com.db.dbworld.payloads.server.os.windows.WindowsServerInfo;
import lombok.experimental.UtilityClass;

/** @deprecated Use {@link com.db.dbworld.app.system.info.dto.ServerInfoFactory} instead. */
@Deprecated(forRemoval = true)
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
            case "linux" -> LinuxServerInfo.builder().linux(true).build();
            case "mac" -> MacServerInfo.builder().mac(true).build();
            default -> BaseServerInfo.builder().build();
        };
    }
}