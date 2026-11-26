package com.db.dbworld.app.media.ingestion.tracking.log;

import org.springframework.web.util.HtmlUtils;

public class HtmlReportBuilder {

    public String build(LogCollector collector) {
        var events = collector.getEvents();
        long errorCount = events.stream().filter(e -> "ERROR".equalsIgnoreCase(e.level())).count();
        StringBuilder html = new StringBuilder("""
                <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
                </head><body><main class="log-report">
                <header class="report-header"><h2>Ingestion report</h2>
                <p class="report-summary">%d event%s · %d error%s</p></header>
                <ol class="log-list">
                """.formatted(events.size(), events.size() == 1 ? "" : "s",
                errorCount, errorCount == 1 ? "" : "s"));

        for (LogEvent event : events) {
            boolean error = "ERROR".equalsIgnoreCase(event.level());
            html.append("<li class='log-entry ").append(error ? "error" : "info").append("'>")
                    .append("<span class='log-level'>").append(error ? "ERROR" : "INFO").append("</span>")
                    .append("<time class='log-time'>").append(escape(event.timestamp())).append("</time>")
                    .append("<span class='log-step'>").append(escape(event.step())).append("</span>")
                    .append("<p class='log-message'>").append(escape(event.message())).append("</p></li>");
        }

        html.append("</ol>");
        if (events.isEmpty()) {
            html.append("<p class='empty-state'>No log events were recorded for this job.</p>");
        }
        html.append("</main></body></html>");
        return html.toString();
    }

    private static String escape(Object value) {
        return HtmlUtils.htmlEscape(String.valueOf(value));
    }
}
