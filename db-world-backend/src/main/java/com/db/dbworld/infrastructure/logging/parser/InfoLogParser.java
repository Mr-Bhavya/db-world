package com.db.dbworld.infrastructure.logging.parser;

import com.db.dbworld.infrastructure.logging.dto.AppInfoLogDto;
import com.google.gson.Gson;

public class InfoLogParser implements LogLineParser<AppInfoLogDto> {

    private final Gson gson = new Gson();

    @Override
    public AppInfoLogDto parse(String line) {
        return gson.fromJson(line, AppInfoLogDto.class);
    }
}


