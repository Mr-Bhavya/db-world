package com.db.dbworld.app.media.ingestion.tracking.log;

import java.util.ArrayList;
import java.util.List;

public class LogCollector {

    private final List<LogEvent> events = new ArrayList<>();

    public void info(String step, String message) {
        events.add(new LogEvent(java.time.Instant.now(), "INFO", step, message));
    }

    public void error(String step, String message) {
        events.add(new LogEvent(java.time.Instant.now(), "ERROR", step, message));
    }

    public List<LogEvent> getEvents() {
        return events;
    }
}
