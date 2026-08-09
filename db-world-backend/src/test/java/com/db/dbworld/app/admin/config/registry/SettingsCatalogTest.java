package com.db.dbworld.app.admin.config.registry;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class SettingsCatalogTest {

    @Test
    void allKeysAreUnique() {
        Set<String> seen = new HashSet<>();
        for (SettingDefinition d : SettingsCatalog.ALL) {
            assertThat(seen.add(d.key())).as("duplicate key %s", d.key()).isTrue();
        }
    }

    @Test
    void everyDefaultParsesUnderItsType() {
        for (SettingDefinition d : SettingsCatalog.ALL) {
            assertThat(d.type().isValid(d.defaultValue()))
                    .as("default '%s' invalid for %s (%s)", d.defaultValue(), d.key(), d.type())
                    .isTrue();
        }
    }

    @Test
    void numericBoundsAreConsistent() {
        for (SettingDefinition d : SettingsCatalog.ALL) {
            if (d.minValue() != null && d.maxValue() != null) {
                assertThat(d.minValue()).as("min<=max for %s", d.key()).isLessThanOrEqualTo(d.maxValue());
            }
        }
    }

    @Test
    void byKey_returnsDefinition_orNull() {
        assertThat(SettingsCatalog.byKey(ConfigKeys.RECOMMEND_GENRE_TOP_N)).isNotNull();
        assertThat(SettingsCatalog.byKey("does.not.exist")).isNull();
    }

    @Test
    void catalogCoversExpectedKeyCount() {
        // 10 recommend + 9 tracking + 1 weather + 3 cdn + 2 wallet + 1 cinema + 11 ipo + 3 push
        //   + 2 media-ingestion = 42
        // (cinema: record auto-publish-on-media; ipo: sources-enabled + 4 per-source base URLs
        //  [ipoguru, nse, chittorgarh, investorgain] + gmp-threshold + hide-listed-after-days
        //  + notify-window-start-hour + notify-window-end-hour + market-holidays + market-holidays-auto;
        //  push: enabled + ipo-topic + ttl-seconds; ingestion: track-review enabled + timeout)
        assertThat(SettingsCatalog.ALL).hasSize(42);
    }
}
