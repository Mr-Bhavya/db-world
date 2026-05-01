package com.db.dbworld.core.role.enums;

public enum Role {
    OWNER,
    ADMIN,
    VIEWER;

    public static Role fromString(String value) {
        try {
            return Role.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown role: " + value);
        }
    }
}
