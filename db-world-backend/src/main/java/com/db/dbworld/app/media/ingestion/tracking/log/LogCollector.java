package com.db.dbworld.app.media.ingestion.tracking.log;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Per-job log buffer. Written by the pipeline thread and read concurrently by the WS broadcaster and
 * report endpoint, so it is thread-safe and hands out immutable snapshots.
 */
public class LogCollector {

    private final List<LogEvent> events = new CopyOnWriteArrayList<>();

    public void info(String step, String message) {
        events.add(new LogEvent(Instant.now(), "INFO", step, message));
    }

    public void error(String step, String message) {
        events.add(new LogEvent(Instant.now(), "ERROR", step, message));
    }

    public List<LogEvent> getEvents() {
        return List.copyOf(events);
    }
}
