package com.db.dbworld.core.processor;

import com.db.dbworld.core.exception.DbWorldException;
import lombok.extern.log4j.Log4j2;
import org.apache.commons.lang3.StringUtils;

import java.util.regex.Pattern;

@Log4j2
public class YtDlpStreamProcessor extends StreamProcessor {

    private static final Pattern WARNING_PATTERN =
            Pattern.compile("^WARNING:", Pattern.CASE_INSENSITIVE);
    private static final Pattern ERROR_PATTERN =
            Pattern.compile("^ERROR:", Pattern.CASE_INSENSITIVE);

    public YtDlpStreamProcessor() {
        super();
    }

    @Override
    protected void processLine(String line, boolean isErrorStream) {
        if (StringUtils.isBlank(line)) return;

        if (isErrorStream) {
            if (WARNING_PATTERN.matcher(line).find()) {
                log.warn("[yt-dlp][warning]: {}", line);
                return;
            }
            if (ERROR_PATTERN.matcher(line).find()) {
                log.error("[yt-dlp][error]: {}", line);
                throw new DbWorldException(line);
            }
            log.info("[yt-dlp][stderr]: {}", line);
            return;
        }

        // stdout — progress JSON or regular output
        if (line.contains("downloaded_bytes") && line.contains("status")) {
            log.debug("[yt-dlp][progress]: {}", line);
            return;
        }

        log.info("[yt-dlp][stdout]: {}", line);
    }
}
