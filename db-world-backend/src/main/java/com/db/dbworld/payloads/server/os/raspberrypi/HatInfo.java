package com.db.dbworld.payloads.server.os.raspberrypi;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class HatInfo {
    private Boolean hatPresent;
    private String hatVendor;
    private String hatProduct;
    private String hatVersion;
    private String hatUuid;
    private List<HatGpioMapping> gpioMappings;
}
