package com.db.dbworld.infrastructure.logging.parser;

import com.db.dbworld.infrastructure.logging.dto.AppRequestLogDto;
import com.google.gson.Gson;
import lombok.extern.log4j.Log4j2;

@Log4j2
public class RequestLogParser implements LogLineParser<AppRequestLogDto> {

    private final Gson gson = new Gson();

    @Override
    public AppRequestLogDto parse(String line) {
        try {
            return gson.fromJson(line, AppRequestLogDto.class);
        } catch (Exception e) {
            String sample = line == null ? "(null)" : (line.length() > 200 ? line.substring(0, 200) : line);
            log.warn("RequestLogParser failed (sample='{}')", sample, e);
            throw e;
        }
    }
}

