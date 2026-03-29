package com.db.dbworld.infrastructure.logging.parser;

import com.db.dbworld.infrastructure.logging.dto.AppDebugLogDto;
import com.google.gson.Gson;

public class DebugLogParser implements LogLineParser<AppDebugLogDto> {

    private final Gson gson = new Gson();

    @Override
    public AppDebugLogDto parse(String line) {
        return gson.fromJson(line, AppDebugLogDto.class);
    }
}

