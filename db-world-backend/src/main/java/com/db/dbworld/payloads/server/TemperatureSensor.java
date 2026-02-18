package com.db.dbworld.payloads.server;

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
    private Double temperatureC;
    private Double temperatureF;
    private String status;
    private String location;
    private Double highThreshold;
    private Double criticalThreshold;
}
