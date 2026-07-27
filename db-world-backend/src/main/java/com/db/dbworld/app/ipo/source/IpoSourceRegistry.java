package com.db.dbworld.app.ipo.source;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;

import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Collects every {@link IpoSource} bean and exposes the subset enabled via the
 * {@code ipo.sources.enabled} setting (a CSV of {@link IpoSource#key()} values).
 *
 * <p>{@link #enabled()} preserves the order the sources were injected in (Spring's bean
 * registration order) — it does NOT reorder to match the CSV's sequence. The CSV only decides
 * membership.
 */
@Component
public class IpoSourceRegistry {

    private final List<IpoSource> sources;
    private final SettingsService settingsService;

    public IpoSourceRegistry(List<IpoSource> sources, SettingsService settingsService) {
        this.sources = sources;
        this.settingsService = settingsService;
    }

    public List<IpoSource> enabled() {
        Set<String> enabledKeys = parseCsv(settingsService.getString(ConfigKeys.IPO_SOURCES_ENABLED));
        return sources.stream()
                .filter(s -> enabledKeys.contains(s.key().toLowerCase(Locale.ROOT)))
                .toList();
    }

    private static Set<String> parseCsv(String csv) {
        if (csv == null || csv.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.toLowerCase(Locale.ROOT))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
