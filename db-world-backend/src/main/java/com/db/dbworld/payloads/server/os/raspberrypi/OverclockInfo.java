package com.db.dbworld.payloads.server.os.raspberrypi;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class OverclockInfo {
    private Boolean overVoltage;
    private Integer armFrequency;
    private Integer coreFrequency;
    private Integer sdramFrequency;
    private Integer gpuFrequency;
    private Boolean turboEnabled;
    private Integer overVoltageMin;
    private Integer overVoltageMax;
    private String overclockPreset;
    private Boolean forceTurbo;
}
