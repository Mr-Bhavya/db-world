package com.db.dbworld.infrastructure.logging.parser;

import com.db.dbworld.infrastructure.logging.dto.AppInfoLogDto;
import com.google.gson.Gson;
import lombok.extern.log4j.Log4j2;

@Log4j2
public class InfoLogParser implements LogLineParser<AppInfoLogDto> {

    private final Gson gson = new Gson();

    @Override
    public AppInfoLogDto parse(String line) {
        try {
            return gson.fromJson(line, AppInfoLogDto.class);
        } catch (Exception e) {
            String sample = line == null ? "(null)" : (line.length() > 200 ? line.substring(0, 200) : line);
            log.warn("InfoLogParser failed (sample='{}')", sample, e);
            throw e;
        }
    }
}


