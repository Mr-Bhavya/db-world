package com.db.dbworld.payloads.server.os.raspberrypi;

import com.db.dbworld.payloads.server.BaseServerInfo;
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
public class RaspberryPiServerInfo extends BaseServerInfo {
    private RaspberryPiInfo raspberryPiInfo;
    private GpioInfo gpioInfo;
    private CameraInfo cameraInfo;
    private HatInfo hatInfo;
    private List<PackageInfo> installedPackages;
    private OverclockInfo overclockInfo;
    private DisplayInfo displayInfo;
}

