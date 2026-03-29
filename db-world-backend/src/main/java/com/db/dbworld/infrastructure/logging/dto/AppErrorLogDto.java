package com.db.dbworld.infrastructure.logging.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AppErrorLogDto {

    private String timestamp;
    private LogType level;
    private String thread;
    private String logger;
    private String message;
    private String exception;
    private String stacktrace;

    public boolean isError() {
        return level == LogType.ERROR;
    }

    public boolean isStdErrFragment() {
        return message != null && message.startsWith("[stderr]");
    }

    public String getRootExceptionLine() {
        String s = exception != null && !exception.isBlank()
                ? exception : stacktrace;

        if (s == null) return null;

        int nl = s.indexOf('\n');
        return nl > 0 ? s.substring(0, nl) : s;
    }
}

