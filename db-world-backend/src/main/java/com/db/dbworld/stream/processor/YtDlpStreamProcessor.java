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
    private static final Pattern JSON_QUOTE_PATTERN = Pattern.compile("^\"|\"$");

    private boolean fileFetched = false;
    private final Runnable onCompleteCallback;

    public YtDlpStreamProcessor(StatusService statusService, MirrorStatus mirrorStatus, Runnable onCompleteCallback) {
        super(statusService, mirrorStatus);
        this.onCompleteCallback = onCompleteCallback;
    }

    @Override
    protected void processLine(String line, boolean isErrorStream) {
        if (isErrorStream) {
            log.error("[yt-dlp][stderr]: {}", line);
            StreamLogger.appendHtmlLine(mirrorStatus, line, true, statusService);
            return;
        }

//        log.info("[yt-dlp][stdout]: {}", line);

        if (line.contains("downloaded_bytes") && line.contains("status")) {
            if (updateProgress(line) && !fileFetched && line.contains("\"status\": \"finished\"")) {
                fileFetched = true;
                onCompleteCallback.run();
            }
        } else {
            StreamLogger.appendHtmlLine(mirrorStatus, line, false, statusService);
        }
    }

    private boolean updateProgress(String jsonLine) {
        if (StringUtils.isBlank(jsonLine)) return false;

        try {
            String cleaned = JSON_QUOTE_PATTERN.matcher(jsonLine.trim()).replaceAll("").replace("\\\"", "\"");
            YtProcessStatus status = GSON.fromJson(cleaned, YtProcessStatus.class);

            if (status != null && status.getDownloaded_bytes() != null) {
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
            }
        } catch (JsonSyntaxException ex) {
            StreamLogger.appendHtmlLine(mirrorStatus, jsonLine + " [JSON ERROR]: " + ex.getMessage(), true, statusService);
            throw new DbWorldException(ex.getMessage());
        } catch (Exception ex) {
            StreamLogger.appendHtmlLine(mirrorStatus, jsonLine + " [FATAL ERROR]: " + ex.getMessage(), true, statusService);
            throw new DbWorldException(ex.getMessage());
        }
        return false;
    }
}

