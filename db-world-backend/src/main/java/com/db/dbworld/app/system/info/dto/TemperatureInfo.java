package com.db.dbworld.app.system.info.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;
import java.util.Map;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class TemperatureInfo {
    private List<TemperatureSensor> sensors;
    private Boolean hasTemperatureSensors;
    private String monitoringSoftware;
    private Double averageTemperatureCelsius;
    private Double averageTemperatureFahrenheit;
    private String highestSensor;
    private Double highestTemperatureCelsius;
    private Double maxTemperatureCelsius;
    /** Fan sensors: each map has keys "name", "rpm". */
    private List<Map<String, Object>> fanSensors;
    private String status;
    private String error;
}
