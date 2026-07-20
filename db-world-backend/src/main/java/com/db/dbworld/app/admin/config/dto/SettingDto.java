package com.db.dbworld.app.admin.config.dto;

public record SettingDto(
        String key,
        String label,
        String description,
        String valueType,
        String value,
        String defaultValue,
        Long minValue,
        Long maxValue,
        boolean requiresRestart,
        String updatedAt,
        String updatedBy
) {}
