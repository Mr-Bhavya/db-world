package com.db.dbworld.app.system.info.dto.os.raspberrypi;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class HatGpioMapping {
    private String function;
    private Integer pin;
    private String description;
    private Boolean activeLow;
}
