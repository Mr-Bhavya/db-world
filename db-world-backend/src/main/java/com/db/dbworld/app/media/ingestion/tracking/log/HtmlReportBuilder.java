package com.db.dbworld.app.media.ingestion.tracking.log;

public class HtmlReportBuilder {

    public String build(LogCollector collector) {

        StringBuilder html = new StringBuilder();

        html.append("<html><head><style>")
                .append("body{font-family:Arial;} .info{color:green;} .error{color:red;}")
                .append("</style></head><body>");

        html.append("<h2>Ingestion Report</h2><ul>");

        for (LogEvent e : collector.getEvents()) {
            html.append("<li class='")
                    .append(e.level().equals("ERROR") ? "error" : "info")
                    .append("'>")
                    .append(e.timestamp()).append(" - ")
                    .append(e.step()).append(" - ")
                    .append(e.message())
                    .append("</li>");
        }

        html.append("</ul></body></html>");

        return html.toString();
    }
}
