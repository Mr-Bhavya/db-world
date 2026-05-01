package com.db.dbworld.payloads.server.os.raspberrypi;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class GpioPin {
    private Integer pin;
    private String name;
    private String mode;
    private String value;
    private String function;
    private String physicalPin;
    private String bcmPin;
    private String wpiPin;
    private Boolean pullUp;
    private Boolean pullDown;
}
