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

    public boolean isStdOutFragment() {
        return message != null && message.startsWith("[stdout]:");
    }

    public String stdOut() {
        return isStdOutFragment()
                ? message.substring(9).trim()
                : null;
    }
}

