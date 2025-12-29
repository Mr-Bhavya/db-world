package com.db.dbworld.stream.processor;

import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.mirror.StatusService;
import lombok.extern.log4j.Log4j2;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@Log4j2
public class StreamLogger {

    private static final Map<Character, String> HTML_ESCAPE_MAP = Map.of(
            '&', "&amp;",
            '<', "&lt;",
            '>', "&gt;"
    );

    private static final DateTimeFormatter TS_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS")
                    .withZone(ZoneId.systemDefault());

    public static void appendHtmlLine(
            MirrorStatus mirrorStatus,
            String raw,
            boolean isError,
            StatusService statusService
    ) {
        // Handle null raw input
        if (raw == null) {
            raw = "[null]";
        }

        // Escape HTML
        StringBuilder escaped = new StringBuilder(raw.length() + 32);
        for (char c : raw.toCharArray()) {
            escaped.append(HTML_ESCAPE_MAP.getOrDefault(c, String.valueOf(c)));
        }

        // Timestamp
        String timestamp = TS_FORMATTER.format(Instant.now());

        String tag = isError ? "[stderr]" : "[stdout]";
        String color = isError ? "#dc3545" : "#198754";

        String html = String.format(
                "<div style='color:%s;font-family:monospace;'>[%s] %s %s</div>",
                color,
                timestamp,
                tag,
                escaped
        );

        String prev = mirrorStatus.getMessage() != null ? mirrorStatus.getMessage() : "";

        try {
            if (isError) {
                statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), prev + html);
            } else {
                statusService.updateStatusMessage(mirrorStatus.getId(), prev + html);
            }
        } catch (Exception e) {
            log.error("Failed to update mirror status for id {}", mirrorStatus.getId(), e);
        }
    }
}
