package com.db.dbworld.app.system.info.dto.os.raspberrypi;

import com.db.dbworld.app.system.info.dto.BaseServerInfo;
import com.db.dbworld.app.system.info.dto.os.linux.PackageInfo;
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
