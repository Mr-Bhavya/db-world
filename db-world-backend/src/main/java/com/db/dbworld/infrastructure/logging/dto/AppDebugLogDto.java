package com.db.dbworld.infrastructure.logging.dto;


import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AppDebugLogDto {

    private String timestamp;
    private LogType level;
    private String thread;
    private String logger;
    private String message;
    private String exception;

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

    public boolean isStdOutFragment() {
        return message != null && message.startsWith("[stdout]:");
    }

    public String stdOut() {
        return isStdOutFragment()
                ? message.substring(9).trim()
                : null;
    }
}

