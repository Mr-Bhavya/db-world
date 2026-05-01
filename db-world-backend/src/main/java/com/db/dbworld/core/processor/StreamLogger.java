package com.db.dbworld.core.processor;

import lombok.extern.log4j.Log4j2;

/**
 * Utility for formatting stream output lines as HTML snippets.
 * The legacy StatusService-based persistence has been removed;
 * callers are responsible for storing the returned HTML string.
 */
@Log4j2
public class StreamLogger {

    private StreamLogger() {}

    /**
     * Builds a timestamped HTML line from a raw output string.
     *
     * @param raw       the raw log line
     * @param isError   true → red stderr style, false → green stdout style
     * @return          an HTML {@code <div>} string ready for embedding in a report
     */
    public static String buildHtmlLine(String raw, boolean isError) {
        if (raw == null) raw = "[null]";

        // Escape HTML special characters
        StringBuilder escaped = new StringBuilder(raw.length() + 32);
        for (char c : raw.toCharArray()) {
            switch (c) {
                case '&' -> escaped.append("&amp;");
                case '<' -> escaped.append("&lt;");
                case '>' -> escaped.append("&gt;");
                default  -> escaped.append(c);
            }
        }

        String tag   = isError ? "[stderr]" : "[stdout]";
        String color = isError ? "#dc3545"  : "#198754";

        return String.format(
                "<div style='color:%s;font-family:monospace;'>%s %s</div>",
                color, tag, escaped
        );
    }
}
