package com.db.dbworld.infrastructure.logging;

import com.db.dbworld.infrastructure.logging.dto.*;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import lombok.extern.log4j.Log4j2;

@Log4j2
public class AppLogParser {

    private final Gson gson = new Gson();

    public AppLogEnvelopeDto parse(String line) {

        try {
            JsonObject obj = JsonParser.parseString(line).getAsJsonObject();

            LogType level = obj.has("level")
                    ? LogType.from(obj.get("level").getAsString())
                    : null;

            // ---------- REQUEST ----------
            if (obj.has("method") && obj.has("uri") && obj.has("status")) {
                AppRequestLogDto dto = gson.fromJson(obj, AppRequestLogDto.class);
                return wrap(LogType.REQUEST, dto, null, null, null);
            }

            // ---------- ERROR ----------
            if (level == LogType.ERROR || obj.has("stacktrace")) {
                AppErrorLogDto dto = gson.fromJson(obj, AppErrorLogDto.class);
                return wrap(LogType.ERROR, null, dto, null, null);
            }

            // ---------- DEBUG ----------
            if (level == LogType.DEBUG || level == LogType.TRACE) {
                AppDebugLogDto dto = gson.fromJson(obj, AppDebugLogDto.class);
                return wrap(LogType.DEBUG, null, null, dto, null);
            }

            // ---------- INFO ----------
            AppInfoLogDto dto = gson.fromJson(obj, AppInfoLogDto.class);
            return wrap(LogType.INFO, null, null, null, dto);

        } catch (Exception e) {
            String sample = line == null ? "(null)" : (line.length() > 200 ? line.substring(0, 200) : line);
            log.warn("AppLogParser failed on line (sample='{}')", sample, e);
            return AppLogEnvelopeDto.raw(line);
        }
    }

    private AppLogEnvelopeDto wrap(
            LogType type,
            AppRequestLogDto req,
            AppErrorLogDto err,
            AppDebugLogDto dbg,
            AppInfoLogDto info
    ) {
        AppLogEnvelopeDto env = new AppLogEnvelopeDto();
        env.setFormat(LogFormat.JSON);
        env.setType(type);
        env.setRequest(req);
        env.setError(err);
        env.setDebug(dbg);
        env.setInfo(info);
        return env;
    }
}

