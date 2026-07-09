package com.db.dbworld.app.admin.config.service;

import com.db.dbworld.app.admin.config.entity.AppConfigEntity;
import com.db.dbworld.app.admin.config.entity.ConfigValueType;
import com.db.dbworld.app.admin.config.registry.SettingDefinition;
import com.db.dbworld.app.admin.config.registry.SettingsCatalog;
import com.db.dbworld.app.admin.config.repository.AppConfigRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Reads and writes runtime-editable settings backed by {@code app_config}.
 * Values are cached in memory and refreshed on every write, so consumers pay
 * no per-read DB cost. Every read is fail-safe: a missing or unparseable value
 * falls back to the {@link SettingsCatalog} default and never throws.
 *
 * <p>Generalises the {@code scheduler_job_config} live-config pattern.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class SettingsService {

    private final AppConfigRepository repo;

    /** key → raw string value. */
    private final ConcurrentHashMap<String, String> cache = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        seedDefaults();
        reloadCache();
    }

    /** Idempotently insert any catalog row that doesn't exist yet. Never overwrites edits. */
    @Transactional
    public void seedDefaults() {
        try {
            for (SettingDefinition d : SettingsCatalog.ALL) {
                if (!repo.existsById(d.key())) {
                    repo.save(AppConfigEntity.builder()
                            .configKey(d.key())
                            .value(d.defaultValue())
                            .valueType(d.type())
                            .category(d.category())
                            .label(d.label())
                            .description(d.description())
                            .defaultValue(d.defaultValue())
                            .minValue(d.minValue())
                            .maxValue(d.maxValue())
                            .requiresRestart(d.requiresRestart())
                            .displayOrder(d.displayOrder())
                            .updatedAt(LocalDateTime.now())
                            .build());
                    log.info("Seeded app_config key '{}'", d.key());
                }
            }
        } catch (Exception e) {
            // Never block boot on a DB hiccup — consumers use catalog defaults meanwhile.
            log.warn("app_config seeding skipped/failed: {}", e.getMessage());
        }
    }

    /** Reloads the whole cache from the DB. */
    public void reloadCache() {
        try {
            var fresh = new ConcurrentHashMap<String, String>();
            repo.findAll().forEach(e -> {
                if (e.getValue() != null) fresh.put(e.getConfigKey(), e.getValue());
            });
            cache.clear();
            cache.putAll(fresh);
        } catch (Exception e) {
            log.warn("app_config cache reload failed (keeping previous cache): {}", e.getMessage());
        }
    }

    // ── Typed reads (fail-safe) ────────────────────────────────────────────────

    public boolean getBoolean(String key) {
        String raw = cache.get(key);
        SettingDefinition def = SettingsCatalog.byKey(key);
        if (raw == null || !ConfigValueType.BOOLEAN.isValid(raw)) {
            return def != null && Boolean.parseBoolean(def.defaultValue());
        }
        return Boolean.parseBoolean(raw.trim());
    }

    public int getInt(String key) {
        String raw = cache.get(key);
        if (raw != null && ConfigValueType.INTEGER.isValid(raw)) {
            return Integer.parseInt(raw.trim());
        }
        SettingDefinition def = SettingsCatalog.byKey(key);
        int fallback = 0;
        if (def != null) {
            try {
                fallback = Integer.parseInt(def.defaultValue().trim());
            } catch (NumberFormatException | NullPointerException e) {
                fallback = 0;
            }
        }
        if (raw != null) log.warn("app_config '{}' value '{}' not an int — using default {}", key, raw, fallback);
        return fallback;
    }

    public long getLong(String key) {
        String raw = cache.get(key);
        if (raw != null && ConfigValueType.LONG.isValid(raw)) {
            return Long.parseLong(raw.trim());
        }
        SettingDefinition def = SettingsCatalog.byKey(key);
        long fallback = 0L;
        if (def != null) {
            try {
                fallback = Long.parseLong(def.defaultValue().trim());
            } catch (NumberFormatException | NullPointerException e) {
                fallback = 0L;
            }
        }
        if (raw != null) log.warn("app_config '{}' value '{}' not a long — using default {}", key, raw, fallback);
        return fallback;
    }

    public String getString(String key) {
        String raw = cache.get(key);
        if (raw != null) return raw;
        SettingDefinition def = SettingsCatalog.byKey(key);
        return def != null ? def.defaultValue() : null;
    }

    // ── Admin queries + mutations ──────────────────────────────────────────────

    public List<AppConfigEntity> findAllOrdered() {
        return repo.findAll().stream()
                .sorted(Comparator.comparing(AppConfigEntity::getCategory)
                        .thenComparingInt(AppConfigEntity::getDisplayOrder))
                .toList();
    }

    @Transactional
    public AppConfigEntity update(String key, String rawValue, String updatedBy) {
        SettingDefinition def = SettingsCatalog.byKey(key);
        if (def == null) throw new IllegalArgumentException("Unknown config key: " + key);
        if (rawValue == null) throw new IllegalArgumentException("value is required");
        if (!def.type().isValid(rawValue)) {
            throw new IllegalArgumentException("Value '" + rawValue + "' is not a valid " + def.type());
        }
        if (def.type() == ConfigValueType.INTEGER || def.type() == ConfigValueType.LONG) {
            long n = Long.parseLong(rawValue.trim());
            if (def.minValue() != null && n < def.minValue())
                throw new IllegalArgumentException(key + " must be >= " + def.minValue());
            if (def.maxValue() != null && n > def.maxValue())
                throw new IllegalArgumentException(key + " must be <= " + def.maxValue());
        }
        AppConfigEntity e = repo.findById(key).orElseGet(() -> seedRow(def));
        e.setValue(rawValue);
        e.setUpdatedBy(updatedBy);
        e.setUpdatedAt(LocalDateTime.now());
        repo.save(e);
        cache.put(key, rawValue);
        log.info("app_config '{}' updated to '{}' by {}", key, rawValue, updatedBy);
        return e;
    }

    @Transactional
    public AppConfigEntity reset(String key, String updatedBy) {
        SettingDefinition def = SettingsCatalog.byKey(key);
        if (def == null) throw new IllegalArgumentException("Unknown config key: " + key);
        return update(key, def.defaultValue(), updatedBy);
    }

    private AppConfigEntity seedRow(SettingDefinition d) {
        return AppConfigEntity.builder()
                .configKey(d.key()).value(d.defaultValue()).valueType(d.type())
                .category(d.category()).label(d.label()).description(d.description())
                .defaultValue(d.defaultValue()).minValue(d.minValue()).maxValue(d.maxValue())
                .requiresRestart(d.requiresRestart()).displayOrder(d.displayOrder())
                .build();
    }
}
