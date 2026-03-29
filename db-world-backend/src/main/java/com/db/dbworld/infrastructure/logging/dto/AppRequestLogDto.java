package com.db.dbworld.infrastructure.logging.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AppRequestLogDto {

    private String timestamp;
    private LogType level;
    private String thread;
    private String logger;
    private String message;

    private String user;
    private String requestId;
    private String traceId;

    private String method;
    private String uri;

    private String status;
    private String duration;

    private String md5;
    private String exception;

    public int getStatusCode() {
        try { return Integer.parseInt(status); }
        catch (Exception e) { return -1; }
    }

    public long getDurationMs() {
        try { return Long.parseLong(duration); }
        catch (Exception e) { return -1; }
    }

    public boolean isErrorStatus() {
        return getStatusCode() >= 400;
    }

    public boolean isSlow(long ms) {
        return getDurationMs() >= ms;
    }
}

