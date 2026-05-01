package com.db.dbworld.infrastructure.logging.parser;

import com.db.dbworld.infrastructure.logging.dto.AppErrorLogDto;
import com.google.gson.Gson;

public class ErrorLogParser implements LogLineParser<AppErrorLogDto> {

    private final Gson gson = new Gson();

    @Override
    public AppErrorLogDto parse(String line) {
        return gson.fromJson(line, AppErrorLogDto.class);
    }
}
