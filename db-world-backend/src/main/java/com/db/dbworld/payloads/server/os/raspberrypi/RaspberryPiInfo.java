package com.db.dbworld.payloads.server.os.raspberrypi;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class RaspberryPiInfo {
    private Boolean isRaspberryPi;
    private String model;
    private String revision;
    private String serial;
    private Integer boardVersion;
    private String hardware;
    private String processor;
    private String firmwareVersion;
    private Integer memoryMB;
    private String manufactureDate;
    private String soc;
    private String maker;
    private String warrantyVoid;
    private String revisionCode;
}
