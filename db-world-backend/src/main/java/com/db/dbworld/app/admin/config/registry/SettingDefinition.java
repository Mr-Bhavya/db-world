package com.db.dbworld.app.admin.config.registry;

import com.db.dbworld.app.admin.config.entity.ConfigValueType;

/** Immutable declaration of one managed setting — the source of truth for defaults + metadata. */
public record SettingDefinition(
        String key,
        ConfigValueType type,
        String category,
        String label,
        String description,
        String defaultValue,
        Long minValue,
        Long maxValue,
        boolean requiresRestart,
        int displayOrder
) {
    // Convenience factories keep the catalog readable.
    static SettingDefinition bool(String key, String category, String label, String description,
                                  boolean def, int order) {
        return new SettingDefinition(key, ConfigValueType.BOOLEAN, category, label, description,
                String.valueOf(def), null, null, false, order);
    }
    static SettingDefinition intg(String key, String category, String label, String description,
                                  int def, Long min, Long max, int order) {
        return new SettingDefinition(key, ConfigValueType.INTEGER, category, label, description,
                String.valueOf(def), min, max, false, order);
    }
    static SettingDefinition lng(String key, String category, String label, String description,
                                 long def, Long min, Long max, int order) {
        return new SettingDefinition(key, ConfigValueType.LONG, category, label, description,
                String.valueOf(def), min, max, false, order);
    }
    static SettingDefinition str(String key, String category, String label, String description,
                                 String def, boolean requiresRestart, int order) {
        return new SettingDefinition(key, ConfigValueType.STRING, category, label, description,
                def, null, null, requiresRestart, order);
    }
}
