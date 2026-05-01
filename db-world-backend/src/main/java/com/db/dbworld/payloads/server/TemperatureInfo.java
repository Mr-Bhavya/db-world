package com.db.dbworld.payloads.server;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;

/** @deprecated Use {@link com.db.dbworld.app.system.info.dto.TemperatureInfo} instead. */
@Deprecated(forRemoval = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class TemperatureInfo {
    private List<TemperatureSensor> sensors;
    private Boolean hasTemperatureSensors;
    private String monitoringSoftware;
    private Double averageTemperatureC;
    private Double averageTemperatureF;
    private String highestSensor;
    private Double highestTemperatureC;
    private Double maxTemperatureCelsius;
    private java.util.List<java.util.Map<String, Object>> fanSensors;

    private String status;
    private String error;
}
