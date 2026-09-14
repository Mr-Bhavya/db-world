package com.db.dbworld.infrastructure.logging.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AppLogEnvelopeDto {

    private LogFormat format;
    private LogType type;

    private AppDebugLogDto debug;
    private AppErrorLogDto error;
    private AppInfoLogDto info;
    private AppRequestLogDto request;

    private String rawLine; // fallback if parsing fails

    public static AppLogEnvelopeDto raw(String line) {
        AppLogEnvelopeDto e = new AppLogEnvelopeDto();
        e.format = LogFormat.RAW;
        e.type = LogType.UNKNOWN;
        e.rawLine = line;
        return e;
    }

    // ---------- helpers ----------

    public boolean isDebug()   { return type == LogType.DEBUG; }
    public boolean isError()   { return type == LogType.ERROR; }
    public boolean isInfo()    { return type == LogType.INFO; }
    public boolean isRequest() { return type == LogType.REQUEST; }

    public String timestamp() {
        if (debug != null) return debug.getTimestamp();
        if (error != null) return error.getTimestamp();
        if (info != null) return info.getTimestamp();
        if (request != null) return request.getTimestamp();
        return null;
    }

    /**
     * The populated DTO, whichever shape this line turned out to be — or the raw line when
     * parsing failed. Lets a caller that doesn't care about the variant (the scheduler
     * run-log lookup, which mixes info and debug lines in one list) hand the payload straight
     * to the serialiser.
     */
    public Object payload() {
        if (debug != null) return debug;
        if (error != null) return error;
        if (info != null) return info;
        if (request != null) return request;
        return rawLine;
    }

    public LogType level() {
        if (debug != null) return debug.getLevel();
        if (error != null) return error.getLevel();
        if (info != null) return info.getLevel();
        if (request != null) return request.getLevel();
        return null;
    }
}
