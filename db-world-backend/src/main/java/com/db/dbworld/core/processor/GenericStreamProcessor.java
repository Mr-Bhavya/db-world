package com.db.dbworld.core.processor;

import lombok.extern.log4j.Log4j2;

@Log4j2
public class GenericStreamProcessor extends StreamProcessor {

    public GenericStreamProcessor() {
        super();
    }

    @Override
    public void processLine(String line, boolean isErrorStream) {
        if (isErrorStream) {
            log.error("[stderr]: {}", line);
        } else {
            log.debug("[stdout]: {}", line);
        }
    }
}
