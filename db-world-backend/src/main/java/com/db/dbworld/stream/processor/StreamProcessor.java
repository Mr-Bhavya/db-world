package com.db.dbworld.stream.processor;

import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.mirror.StatusService;
import lombok.Getter;
import lombok.extern.log4j.Log4j2;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.function.Consumer;

@Getter
@Log4j2
public abstract class StreamProcessor {

    protected final StatusService statusService;
    protected final MirrorStatus mirrorStatus;
    protected final String statusId;
    protected final boolean statusEnabled; // Flag to track if status tracking is enabled

    // Parameterized constructor for status-enabled mode
    protected StreamProcessor(StatusService statusService, MirrorStatus mirrorStatus) {
        this.statusService = statusService;
        this.mirrorStatus = mirrorStatus;
        this.statusId = mirrorStatus != null ? mirrorStatus.getId() : null;
        this.statusEnabled = statusService != null && mirrorStatus != null && statusId != null;

        if (!statusEnabled) {
            log.debug("StreamProcessor created without status tracking enabled");
        } else {
            log.debug("StreamProcessor created with status tracking enabled for status: {}", statusId);
        }
    }

    // Default constructor for status-disabled mode
    protected StreamProcessor() {
        this.statusService = null;
        this.mirrorStatus = null;
        this.statusId = null;
        this.statusEnabled = false;
        log.debug("StreamProcessor created with default (no-argument) constructor - status tracking disabled");
    }

    public void handle(InputStream inputStream, boolean isErrorStream) {
        if (!statusEnabled) {
            // Simple logging mode - no status tracking
            handleWithoutStatus(inputStream, isErrorStream);
            return;
        }

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {

            String line;
            while ((line = reader.readLine()) != null) {
                // Check if status still exists and is not canceled
                try {
                    MirrorStatus currentStatus = statusService.getStatusById(statusId);
                    if (currentStatus == null) {
                        log.debug("Status {} no longer exists, stopping stream processing", statusId);
                        break;
                    }
                    if (currentStatus.isCancelled()) {
                        log.debug("Status {} was cancelled, stopping stream processing", statusId);
                        break;
                    }
                } catch (Exception ex) {
                    log.warn("Error checking status: {}. Continuing with processing...", ex.getMessage());
                }

                processLine(line, isErrorStream);
            }

        } catch (IOException ex) {
            log.error("Stream read error", ex);
            try {
                StreamLogger.appendHtmlLine(
                        mirrorStatus,
                        "[ERROR] " + ex.getMessage(),
                        true,
                        statusService
                );
            } catch (Exception logEx) {
                log.error("Failed to log stream error to HTML", logEx);
            }
        }
    }

    // Fallback method when status dependencies are not enabled
    private void handleWithoutStatus(InputStream inputStream, boolean isErrorStream) {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {

            String line;
            while ((line = reader.readLine()) != null) {
                processLine(line, isErrorStream);
            }

        } catch (IOException ex) {
            log.error("Stream read error (status tracking disabled)", ex);
        }
    }

    protected abstract void processLine(String line, boolean isErrorStream);

    public Consumer<String> stdoutConsumer() {
        if (!statusEnabled) {
            // Return a consumer that processes lines directly (console only)
            return line -> processLine(line, false);
        }

        return line -> {
            try {
                // Check status before processing
                MirrorStatus currentStatus = statusService.getStatusById(statusId);
                if (currentStatus != null && !currentStatus.isCancelled()) {
                    processLine(line, false);
                }
            } catch (Exception ex) {
                log.warn("Error in stdoutConsumer, processing line anyway: {}", ex.getMessage());
                processLine(line, false);
            }
        };
    }

    public Consumer<String> stderrConsumer() {
        if (!statusEnabled) {
            // Return a consumer that processes lines directly (console only)
            return line -> processLine(line, true);
        }

        return line -> {
            try {
                // Check status before processing
                MirrorStatus currentStatus = statusService.getStatusById(statusId);
                if (currentStatus != null && !currentStatus.isCancelled()) {
                    processLine(line, true);
                }
            } catch (Exception ex) {
                log.warn("Error in stderrConsumer, processing line anyway: {}", ex.getMessage());
                processLine(line, true);
            }
        };
    }
}