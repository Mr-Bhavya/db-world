package com.db.dbworld.logging.parser;

import com.db.dbworld.logging.dto.AppDebugLogDto;
import com.google.gson.Gson;

public class DebugLogParser implements LogLineParser<AppDebugLogDto> {

    private final Gson gson = new Gson();

    @Override
    public AppDebugLogDto parse(String line) {
        return gson.fromJson(line, AppDebugLogDto.class);
    }
}

