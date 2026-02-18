package com.db.dbworld.payloads.server.os.windows;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class WindowsBatteryInfo {
    private Boolean hasBattery;
    private Integer chargeRemaining;
    private Integer fullChargeCapacity;
    private Integer designedCapacity;
    private String status;
    private Integer voltage;
    private Integer wearLevel;
    private String chemistry;
    private Integer timeRemaining;
    private String batteryName;
}
