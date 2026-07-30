package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.SubscriptionCategoryDto;
import lombok.extern.log4j.Log4j2;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * (De)serializes the subscription category → multiple map (QIB/NII/Retail/Employee/Shareholder/
 * Anchor/...) stored as one JSON object string on
 * {@link com.db.dbworld.app.ipo.entity.IpoSubscriptionHistoryEntity#getCategoriesJson()}, so the
 * tracker supports any category a source reports instead of a fixed set of columns.
 *
 * <p>Category order is preserved end-to-end: callers pass in (and get back) a
 * {@link LinkedHashMap} so whatever order the source reported its categories in survives to the
 * frontend, which applies its own preferred display order later.
 *
 * <p>Never throws: a null/blank/malformed/non-object JSON string deserializes to an empty map
 * (logged at WARN) — same "map what's present, never fail the caller" tolerance as
 * {@link com.db.dbworld.app.ipo.source.support.IpoJsonUtil} applies to the source adapters.
 */
@Log4j2
public final class IpoSubscriptionJson {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private IpoSubscriptionJson() {}

    /** @return the JSON object string for {@code categories} (insertion order preserved), or {@code null} if null/empty. */
    public static String toJson(Map<String, BigDecimal> categories) {
        if (categories == null || categories.isEmpty()) {
            return null;
        }
        ObjectNode node = MAPPER.createObjectNode();
        categories.forEach((key, value) -> {
            if (key != null && value != null) {
                node.put(key, value);
            }
        });
        return node.toString();
    }

    /** @return the JSON array string for the per-category {@code detail} list, or {@code null} if null/empty. */
    public static String toDetailJson(List<SubscriptionCategoryDto> detail) {
        if (detail == null || detail.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(detail);
        } catch (Exception e) {
            log.warn("Failed to serialize IPO subscription detail — storing none: {}", e.toString());
            return null;
        }
    }

    /** @return the per-category detail list parsed from {@code json}; empty (never null, never throws) if blank/malformed. */
    public static List<SubscriptionCategoryDto> fromDetailJson(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<SubscriptionCategoryDto> parsed = MAPPER.readValue(json, new TypeReference<List<SubscriptionCategoryDto>>() {});
            return parsed == null ? List.of() : parsed;
        } catch (Exception e) {
            log.warn("Failed to parse IPO subscription detail JSON — treating as empty: {}", e.toString());
            return List.of();
        }
    }

    /** @return an order-preserving map parsed from {@code json}; empty (never null, never throws) if blank/malformed. */
    public static Map<String, BigDecimal> fromJson(String json) {
        Map<String, BigDecimal> result = new LinkedHashMap<>();
        if (json == null || json.isBlank()) {
            return result;
        }
        try {
            JsonNode root = MAPPER.readTree(json);
            if (root == null || !root.isObject()) {
                log.warn("IPO subscription categories JSON is not a JSON object — treating as empty: {}", json);
                return result;
            }
            for (Map.Entry<String, JsonNode> entry : root.properties()) {
                BigDecimal value = entry.getValue().asDecimal(null);
                if (value != null) {
                    result.put(entry.getKey(), value);
                }
            }
            return result;
        } catch (Exception e) {
            log.warn("Failed to parse IPO subscription categories JSON — treating as empty: {}", e.toString());
            return new LinkedHashMap<>();
        }
    }
}
