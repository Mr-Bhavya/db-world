package com.db.dbworld.app.ipo.source.support;

import com.fasterxml.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Tolerant {@link JsonNode} field extraction shared by the JSON source adapters (IPO Guru, NSE).
 * Every accessor is null-safe by design: a missing/renamed/null field or an unparseable value
 * yields {@code null} rather than throwing — per the Phase 2 brief, "map what's present, leave
 * the rest null" so a single upstream field rename never fails the whole fetch.
 */
public final class IpoJsonUtil {

    private IpoJsonUtil() {}

    public static String text(JsonNode node, String field) {
        if (node == null) {
            return null;
        }
        JsonNode v = node.path(field);
        return v.isMissingNode() || v.isNull() ? null : v.asText(null);
    }

    public static BigDecimal decimal(JsonNode node, String field) {
        if (node == null) {
            return null;
        }
        JsonNode v = node.path(field);
        if (v.isMissingNode() || v.isNull()) {
            return null;
        }
        try {
            return new BigDecimal(v.asText().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static Integer integer(JsonNode node, String field) {
        if (node == null) {
            return null;
        }
        JsonNode v = node.path(field);
        if (v.isMissingNode() || v.isNull()) {
            return null;
        }
        try {
            return Integer.valueOf(v.asText().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static LocalDate date(JsonNode node, String field) {
        return IpoDateParser.parse(text(node, field));
    }
}
