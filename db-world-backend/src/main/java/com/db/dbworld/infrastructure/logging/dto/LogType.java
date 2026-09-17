package com.db.dbworld.infrastructure.logging.dto;

public enum LogType {
    ERROR,
    WARN,
    INFO,
    DEBUG,
    TRACE,
    REQUEST,
    UNKNOWN;

    /**
     * The level named on a log line, or {@link #UNKNOWN} if it isn't one of ours.
     *
     * <p>This deliberately does not throw. It used to, and {@code WARN} was commented out of
     * this enum, so every WARN line in {@code db-world-info.json} blew up {@code AppLogParser}
     * — which logs that failure <em>at WARN</em>, into the same file. Each read of the log
     * therefore appended one new unparseable line per unparseable line it had just read, and
     * the file grew every time an admin opened the Log Viewer. WARN is a real level now, and
     * an unrecognised one can no longer restart that loop.
     */
    public static LogType from(String v) {
        if (v == null) return null;
        try {
            return LogType.valueOf(v.toUpperCase());
        } catch (IllegalArgumentException e) {
            return UNKNOWN;
        }
    }
}
