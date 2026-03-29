package com.db.dbworld.infrastructure.logging.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AppInfoLogDto {
    private String timestamp;
    private LogType level;
    private String thread;
    private String logger;
    private String message;
    private String exception;

    public boolean hasException() {
        return exception != null && !exception.isBlank();
    }

    public boolean isError() {
        return level == LogType.ERROR;
    }
}
