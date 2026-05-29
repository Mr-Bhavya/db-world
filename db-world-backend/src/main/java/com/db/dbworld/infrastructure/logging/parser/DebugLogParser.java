package com.db.dbworld.infrastructure.logging.parser;

import com.db.dbworld.infrastructure.logging.dto.AppDebugLogDto;
import com.google.gson.Gson;
import lombok.extern.log4j.Log4j2;

@Log4j2
public class DebugLogParser implements LogLineParser<AppDebugLogDto> {

    private final Gson gson = new Gson();

    @Override
    public AppDebugLogDto parse(String line) {
        try {
            return gson.fromJson(line, AppDebugLogDto.class);
        } catch (Exception e) {
            String sample = line == null ? "(null)" : (line.length() > 200 ? line.substring(0, 200) : line);
            log.warn("DebugLogParser failed (sample='{}')", sample, e);
            throw e;
        }
    }
}

