package com.db.dbworld.logging.parser;

import com.db.dbworld.logging.dto.AppRequestLogDto;
import com.google.gson.Gson;

public class RequestLogParser implements LogLineParser<AppRequestLogDto> {

    private final Gson gson = new Gson();

    @Override
    public AppRequestLogDto parse(String line) {
        return gson.fromJson(line, AppRequestLogDto.class);
    }
}

