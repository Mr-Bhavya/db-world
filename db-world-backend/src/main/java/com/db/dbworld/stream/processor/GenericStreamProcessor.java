package com.db.dbworld.stream.processor;

import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.StatusService;
import lombok.extern.log4j.Log4j2;

@Log4j2
public class GenericStreamProcessor extends StreamProcessor {

    public GenericStreamProcessor(StatusService statusService, MirrorStatus mirrorStatus) {
        super(statusService, mirrorStatus);
    }

    @Override
    protected void processLine(String line, boolean isErrorStream) {
        if (isErrorStream) {
            log.error("[stderr]: {}", line);
        } else {
            log.info("[stdout]: {}", line);
        }

        StreamLogger.appendHtmlLine(mirrorStatus, line, isErrorStream, statusService);
    }
}

