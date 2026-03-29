package com.db.dbworld.core.processor;

import lombok.extern.log4j.Log4j2;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.function.Consumer;

@Log4j2
public abstract class StreamProcessor {

    // StatusService was removed — processors now operate in log-only mode.
    // Legacy status-tracking constructors have been removed along with the
    // deprecated com.db.dbworld.services.mirror.StatusService dependency.

    protected StreamProcessor() {
        log.debug("StreamProcessor created (log-only mode)");
    }

    public void handle(InputStream inputStream, boolean isErrorStream) {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {

            String line;
            while ((line = reader.readLine()) != null) {
                processLine(line, isErrorStream);
            }

        } catch (IOException ex) {
            log.error("Stream read error", ex);
        }
    }

    protected abstract void processLine(String line, boolean isErrorStream);

    public Consumer<String> stdoutConsumer() {
        return line -> processLine(line, false);
    }

    public Consumer<String> stderrConsumer() {
        return line -> processLine(line, true);
    }
}
