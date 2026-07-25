package com.db.dbworld.app.ipo.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class IpoSubscriptionJsonTest {

    @Test
    void toJson_thenFromJson_roundTripsPreservingInsertionOrder() {
        Map<String, BigDecimal> categories = new LinkedHashMap<>();
        categories.put("NII", new BigDecimal("5.30"));
        categories.put("QIB", new BigDecimal("2.10"));
        categories.put("Retail", new BigDecimal("8.00"));
        categories.put("Employee", new BigDecimal("1.20"));

        String json = IpoSubscriptionJson.toJson(categories);
        Map<String, BigDecimal> roundTripped = IpoSubscriptionJson.fromJson(json);

        assertThat(roundTripped.keySet()).containsExactly("NII", "QIB", "Retail", "Employee");
        assertThat(roundTripped.get("NII")).isEqualByComparingTo("5.30");
        assertThat(roundTripped.get("QIB")).isEqualByComparingTo("2.10");
        assertThat(roundTripped.get("Retail")).isEqualByComparingTo("8.00");
        assertThat(roundTripped.get("Employee")).isEqualByComparingTo("1.20");
    }

    @Test
    void toJson_nullMap_returnsNull() {
        assertThat(IpoSubscriptionJson.toJson(null)).isNull();
    }

    @Test
    void toJson_emptyMap_returnsNull() {
        assertThat(IpoSubscriptionJson.toJson(Map.of())).isNull();
    }

    @Test
    void fromJson_nullString_returnsEmptyMap() {
        assertThat(IpoSubscriptionJson.fromJson(null)).isEmpty();
    }

    @Test
    void fromJson_blankString_returnsEmptyMap() {
        assertThat(IpoSubscriptionJson.fromJson("   ")).isEmpty();
    }

    @Test
    void fromJson_malformedJson_returnsEmptyMapNeverThrows() {
        assertThat(IpoSubscriptionJson.fromJson("{not valid json")).isEmpty();
    }

    @Test
    void fromJson_validJsonButNotAnObject_returnsEmptyMap() {
        assertThat(IpoSubscriptionJson.fromJson("[1,2,3]")).isEmpty();
        assertThat(IpoSubscriptionJson.fromJson("\"just a string\"")).isEmpty();
    }

    @Test
    void fromJson_singleCategory_parsesCorrectly() {
        Map<String, BigDecimal> result = IpoSubscriptionJson.fromJson("{\"QIB\":\"12.50\"}");

        assertThat(result).hasSize(1);
        assertThat(result.get("QIB")).isEqualByComparingTo("12.50");
    }

    @Test
    void fromJson_returnsAMutableOrderPreservingMapType() {
        // downstream callers (IpoMapper) may want to iterate/lookup case-insensitively without
        // worrying about the concrete map falling back to hash order.
        Map<String, BigDecimal> result = IpoSubscriptionJson.fromJson("{\"B\":\"1\",\"A\":\"2\"}");

        assertThat(result).isInstanceOf(LinkedHashMap.class);
        assertThat(List.copyOf(result.keySet())).containsExactly("B", "A");
    }
}
