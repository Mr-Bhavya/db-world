package com.db.dbworld.stream.processor;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.payloads.YtProcessStatus;
import com.db.dbworld.services.mirror.StatusService;
import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;
import lombok.extern.log4j.Log4j2;
import org.apache.commons.lang3.StringUtils;

import java.util.regex.Pattern;

@Log4j2
public class YtDlpStreamProcessor extends StreamProcessor {

    private static final Gson GSON = new Gson();

    private static final Pattern JSON_QUOTE_PATTERN =
            Pattern.compile("^\"|\"$");

    private static final Pattern WARNING_PATTERN =
            Pattern.compile("^WARNING:", Pattern.CASE_INSENSITIVE);
    private static final Pattern ERROR_PATTERN =
            Pattern.compile("^ERROR:", Pattern.CASE_INSENSITIVE);

    private boolean fileFetched = false;

    public YtDlpStreamProcessor(StatusService statusService, MirrorStatus mirrorStatus) {
        super(statusService, mirrorStatus);
    }

    public YtDlpStreamProcessor() {
        super();
    }

    @Override
    protected void processLine(String line, boolean isErrorStream) {

        if (StringUtils.isBlank(line)) {
            return;
        }

        /* =========================
         * STDERR
         * ========================= */
        if (isErrorStream) {

            if (WARNING_PATTERN.matcher(line).find()) {
                log.warn("[yt-dlp][warning]: {}", line);

                if (statusEnabled) {
                    StreamLogger.appendHtmlLine(
                            mirrorStatus, line, false, statusService
                    );
                }
                return;
            }

            if (ERROR_PATTERN.matcher(line).find()) {
                log.error("[yt-dlp][error]: {}", line);

                if (statusEnabled) {
                    StreamLogger.appendHtmlLine(
                            mirrorStatus, line, true, statusService
                    );
                }
                throw new DbWorldException(line);
            }

            log.info("[yt-dlp][stderr]: {}", line);

            if (statusEnabled) {
                StreamLogger.appendHtmlLine(
                        mirrorStatus, line, false, statusService
                );
            }
            return;
        }

        /* =========================
         * STDOUT
         * ========================= */

        if (line.contains("downloaded_bytes") && line.contains("status")) {

            boolean updated = statusEnabled && updateProgress(line);

            if (updated && !fileFetched && line.contains("\"status\":\"finished\"")) {
                fileFetched = true;
                log.info("[yt-dlp] Download finished");
            }
            return;
        }

        if (statusEnabled) {
            StreamLogger.appendHtmlLine(
                    mirrorStatus, line, false, statusService
            );
        }
    }

    private boolean updateProgress(String jsonLine) {

        try {
            String cleaned = JSON_QUOTE_PATTERN
                    .matcher(jsonLine.trim())
                    .replaceAll("")
                    .replace("\\\"", "\"");

            YtProcessStatus status =
                    GSON.fromJson(cleaned, YtProcessStatus.class);

            if (status == null || status.getDownloaded_bytes() == null) {
                return false;
            }

            statusService.updateMirrorStatusWithDownloadState(
                    mirrorStatus.getId(),
                    new MirrorStatus.DownloadStatus(
                            status.getSpeed(),
                            (long) status.getEta(),
                            status.getDownloaded_bytes(),
                            status.getTotal_bytes()
                    )
            );

            return true;

        } catch (JsonSyntaxException ex) {
            log.debug("yt-dlp partial JSON ignored");
            return false;

        } catch (Exception ex) {
            log.error("Fatal yt-dlp error", ex);
            throw new DbWorldException(ex.getMessage());
        }
    }
}

