package com.db.dbworld.app.system.info.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class HealthStatus {
    private Integer score;
    private HealthLevel level;
    private List<String> warnings;
    private List<String> issues;
    private List<String> recommendations;
    private Long timestamp;

    public enum HealthLevel {
        EXCELLENT,
        GOOD,
        FAIR,
        POOR,
        CRITICAL
    }
}
