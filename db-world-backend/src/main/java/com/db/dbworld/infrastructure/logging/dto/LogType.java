package com.db.dbworld.infrastructure.logging.dto;

public enum LogType {
    ERROR,
    INFO,
    DEBUG,
    TRACE,
//    WARN,
    REQUEST,
    UNKNOWN;

    public static LogType from(String v) {
        if (v == null) return null;
        return LogType.valueOf(v.toUpperCase());
    }
}
