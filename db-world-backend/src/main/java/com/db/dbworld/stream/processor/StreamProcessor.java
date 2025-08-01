package com.db.dbworld.stream.processor;

import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.mirror.StatusService;
import lombok.extern.log4j.Log4j2;

import java.io.*;
import java.nio.charset.StandardCharsets;

@Log4j2
public abstract class StreamProcessor {

    protected final StatusService statusService;
    protected final MirrorStatus mirrorStatus;
    protected final String statusId;

    protected StreamProcessor(StatusService statusService, MirrorStatus mirrorStatus) {
        this.statusService = statusService;
        this.mirrorStatus = mirrorStatus;
        this.statusId = mirrorStatus.getId();
    }

    public void handle(InputStream inputStream, boolean isErrorStream) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (statusService.getStatusById(statusId).isCancelled()) return;
                processLine(line, isErrorStream);
            }
        } catch (IOException | InterruptedException ex) {
            log.error("Stream read error", ex);
            StreamLogger.appendHtmlLine(mirrorStatus, "[ERROR]: " + ex.getMessage(), true, statusService);
            Thread.currentThread().interrupt(); // propagate interrupt
        }
    }

    protected abstract void processLine(String line, boolean isErrorStream) throws IOException, InterruptedException;
}

