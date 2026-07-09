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
        // 10 recommend + 9 tracking + 1 weather + 3 cdn = 23
        assertThat(SettingsCatalog.ALL).hasSize(23);
    }
}
