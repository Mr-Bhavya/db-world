package com.db.dbworld.app.admin.config.entity;

/** The storage/parse type of an {@link AppConfigEntity} value. */
public enum ConfigValueType {
    BOOLEAN, INTEGER, LONG, STRING;

    /** Parses {@code raw} to the Java type; assumes {@link #isValid} already passed. */
    public Object parse(String raw) {
        return switch (this) {
            case BOOLEAN -> Boolean.parseBoolean(raw);
            case INTEGER -> Integer.parseInt(raw.trim());
            case LONG    -> Long.parseLong(raw.trim());
            case STRING  -> raw;
        };
    }

    /** True when {@code raw} can be parsed as this type. STRING accepts anything (incl. null → false). */
    public boolean isValid(String raw) {
        if (raw == null) return this == STRING ? false : false;
        try {
            switch (this) {
                case BOOLEAN -> {
                    String v = raw.trim().toLowerCase();
                    return v.equals("true") || v.equals("false");
                }
                case INTEGER -> Integer.parseInt(raw.trim());
                case LONG    -> Long.parseLong(raw.trim());
                case STRING  -> { return true; }
            }
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }
}
