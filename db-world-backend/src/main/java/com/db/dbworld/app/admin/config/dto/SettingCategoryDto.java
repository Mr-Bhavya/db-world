package com.db.dbworld.app.admin.config.dto;

import java.util.List;

public record SettingCategoryDto(String category, List<SettingDto> settings) {}
