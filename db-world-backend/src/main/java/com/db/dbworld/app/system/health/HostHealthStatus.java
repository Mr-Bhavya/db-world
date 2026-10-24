package com.db.dbworld.app.system.health;

import java.util.Locale;

/**
 * The four states {@code dbworldctl doctor} reports for a check and for the report overall.
 *
 * <p>The wire form is the lower-case name ({@code ok}, {@code warn}, ...). The report is written
 * by a shell script on the Pi, not by this app, so anything unexpected — a typo, a future state,
 * a missing field — reads as {@link #UNKNOWN} rather than failing the whole report.
 */
public enum HostHealthStatus {
    OK, WARN, FAIL, UNKNOWN;

    /** Lenient parse: case and surrounding whitespace are ignored, anything else is UNKNOWN. */
    public static HostHealthStatus parse(String raw) {
        if (raw == null) return UNKNOWN;
        return switch (raw.trim().toLowerCase(Locale.ROOT)) {
            case "ok"   -> OK;
            case "warn" -> WARN;
            case "fail" -> FAIL;
            default     -> UNKNOWN;
        };
    }

    /** The form the report file and the admin UI use. */
    public String wire() {
        return name().toLowerCase(Locale.ROOT);
    }

    /**
     * How bad this is, for picking the worst of several. UNKNOWN sits between OK and WARN: a
     * check that could not run is worth a look, but it is not evidence that something broke.
     */
    public int severity() {
        return switch (this) {
            case OK      -> 0;
            case UNKNOWN -> 1;
            case WARN    -> 2;
            case FAIL    -> 3;
        };
    }
}
