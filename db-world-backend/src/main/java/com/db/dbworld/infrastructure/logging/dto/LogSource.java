package com.db.dbworld.infrastructure.logging.dto;

import java.util.List;

public enum LogSource {

    APP(List.of("info", "error", "debug", "request"), true, true),
    NGINX(List.of("access", "api_access", "cdn_access", "cdn_error"), false, false),
    ARIA2(List.of("main"), false, false),
    MYSQL(List.of("backup"), false, false);

    private final List<String> subTypes;
    private final boolean supportsJson;
    private final boolean supportsHistory;

    LogSource(List<String> subTypes, boolean supportsJson, boolean supportsHistory) {
        this.subTypes = subTypes;
        this.supportsJson = supportsJson;
        this.supportsHistory = supportsHistory;
    }

    public List<String> getSubTypes()    { return subTypes; }
    public boolean isSupportsJson()      { return supportsJson; }
    public boolean isSupportsHistory()   { return supportsHistory; }

    public static LogSource from(String s) {
        try {
            return valueOf(s.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                "Unknown log source: '" + s + "'. Valid: app, nginx, aria2, mysql");
        }
    }
}
