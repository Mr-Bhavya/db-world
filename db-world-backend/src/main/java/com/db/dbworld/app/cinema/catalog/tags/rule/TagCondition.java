package com.db.dbworld.app.cinema.catalog.tags.rule;

import lombok.Data;

import java.util.List;

/**
 * One row of an admin-built tag rule: a field, a comparison, and a value.
 *
 * <p>Deliberately not an expression to parse. The admin picks {@code field} and {@code operator}
 * from dropdowns the backend supplied ({@link FilterFieldRegistry}), and types only the value — so
 * there is no query language, and nothing an admin enters ever becomes SQL text.
 *
 * <p>Conditions AND together. That covers every rail asked for so far ("Hindi AND rated 8+ AND
 * released this year"); OR would need grouping, and a flat AND list is far easier to reason about
 * than a half-implemented boolean tree.
 */
@Data
public class TagCondition {

    /** Field name from {@link FilterFieldRegistry#availableFields()}. Rejected if unknown. */
    private String field;

    /** Operator value legal for that field's type. Rejected if not offered for the field. */
    private String operator;

    /** Single value for scalar comparisons ({@code eq}, {@code gte}, {@code withinLastDays}, …). */
    private Object value;

    /** Multi-value for {@code in} / {@code notIn}, including genre and provider pickers. */
    private List<Object> values;

    /** True when there is nothing to compare — such a row is skipped rather than failing the rule. */
    public boolean isBlank() {
        if (field == null || field.isBlank() || operator == null || operator.isBlank()) return true;
        // Presence and null-check operators are complete on their own.
        return switch (operator) {
            case "hasAny", "hasNone", "isSet", "isUnset" -> false;
            case "in", "notIn" -> values == null || values.isEmpty();
            default -> value == null || String.valueOf(value).isBlank();
        };
    }
}
