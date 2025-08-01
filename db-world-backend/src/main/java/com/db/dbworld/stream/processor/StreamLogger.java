package com.db.dbworld.stream.processor;

import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.mirror.StatusService;

import java.util.Map;

public class StreamLogger {

    private static final Map<Character, String> HTML_ESCAPE_MAP = Map.of(
            '&', "&amp;",
            '<', "&lt;",
            '>', "&gt;"
    );

    public static void appendHtmlLine(MirrorStatus mirrorStatus, String raw, boolean isError, StatusService statusService) {
        StringBuilder escaped = new StringBuilder(raw.length() + 20);
        for (char c : raw.toCharArray()) {
            escaped.append(HTML_ESCAPE_MAP.getOrDefault(c, String.valueOf(c)));
        }

        String tag = isError ? "[stderr] " : "[stdout] ";
        String color = isError ? "#dc3545" : "#198754";

        String html = String.format(
                "<div style='color:%s;font-family:monospace;'>%s%s</div>",
                color, tag, escaped
        );

        String prev = mirrorStatus.getMessage() != null ? mirrorStatus.getMessage() : "";
        if(isError) {
            statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), prev + html);
        }else{
            statusService.updateStatusMessage(mirrorStatus.getId(), prev + html);
        }
    }
}

