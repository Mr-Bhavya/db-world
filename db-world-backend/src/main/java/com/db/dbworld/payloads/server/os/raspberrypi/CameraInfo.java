package com.db.dbworld.payloads.server.os.raspberrypi;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class CameraInfo {
    private Boolean cameraEnabled;
    private Boolean cameraDetected;
    private String cameraModel;
    private String cameraDriver;
    private String cameraResolution;
    private Boolean cameraSupported;
    private String cameraFirmware;
}
