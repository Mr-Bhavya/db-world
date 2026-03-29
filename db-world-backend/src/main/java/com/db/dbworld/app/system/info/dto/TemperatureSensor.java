package com.db.dbworld.app.system.info.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class TemperatureSensor {
    private String name;
    private String type;
    /** Temperature in Celsius. */
    private Double temperatureCelsius;
    /** Temperature in Fahrenheit. */
    private Double temperatureFahrenheit;
    private String status;
    private String location;
    private Double highThreshold;
    private Double criticalThreshold;
}
