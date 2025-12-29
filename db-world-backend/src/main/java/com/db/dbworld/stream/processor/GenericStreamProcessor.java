package com.db.dbworld.stream.processor;

import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.mirror.StatusService;
import lombok.extern.log4j.Log4j2;

@Log4j2
public class GenericStreamProcessor extends StreamProcessor {

    // Constructor for status-enabled mode
    public GenericStreamProcessor(StatusService statusService, MirrorStatus mirrorStatus) {
        super(statusService, mirrorStatus);
    }

    // Default constructor for simple logging mode
    public GenericStreamProcessor() {
        super(); // Calls the no-argument parent constructor
    }

    @Override
    public void processLine(String line, boolean isErrorStream) {
        // Always log to console
        if (isErrorStream) {
            log.error("[stderr]: {}", line);
        } else {
            log.info("[stdout]: {}", line);
        }

        // If status tracking is enabled, also log to HTML
        if (isStatusEnabled()) {
            try {
                StreamLogger.appendHtmlLine(
                        getMirrorStatus(),
                        line,
                        isErrorStream,
                        getStatusService()
                );
            } catch (Exception ex) {
                log.warn("Failed to log to HTML: {}", ex.getMessage());
            }
        }
    }
}