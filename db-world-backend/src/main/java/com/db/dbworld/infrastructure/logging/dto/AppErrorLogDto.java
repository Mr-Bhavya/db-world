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

    /**
     * Correlation slots emitted by log4j2's JSON layout. Declared here because Gson only
     * populates fields it can see: without them the ids were written to the file and then
     * dropped on the way back out, which is why the Log Viewer's traceId filter never
     * matched an app log line. {@code jobRunId}/{@code job} are present only on lines
     * emitted inside a scheduler run.
     */
    private String traceId;
    private String requestId;
    private String job;
    private String jobRunId;

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

