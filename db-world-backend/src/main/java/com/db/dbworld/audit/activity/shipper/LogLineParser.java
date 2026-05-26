package com.db.dbworld.audit.activity.shipper;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * Parses one nginx JSON access-log line into a {@link LogLineEvent}.
 * Returns empty on malformed JSON or missing required fields (download_id, type).
 */
@Log4j2
@Component
@RequiredArgsConstructor
public class LogLineParser {

    private final ObjectMapper objectMapper;

    public Optional<LogLineEvent> parse(String line) {
        if (line == null || line.isBlank()) return Optional.empty();
        try {
            JsonNode node = objectMapper.readTree(line);

            String downloadId = textOrNull(node, "download_id");
            String type = textOrNull(node, "type");
            if (downloadId == null || downloadId.isBlank()) return Optional.empty();
            if (type == null || (!"DOWNLOAD".equals(type) && !"ONLINE".equals(type))) return Optional.empty();

            String timeStr = textOrNull(node, "time");
            Instant time = timeStr != null ? parseTime(timeStr) : Instant.now();

            return Optional.of(new LogLineEvent(
                    downloadId,
                    type,
                    time,
                    textOrNull(node, "request_id"),
                    intOr(node, "status", 0),
                    longOr(node, "bytes_sent", 0L),
                    textOrNull(node, "content_range"),
                    textOrNull(node, "real_ip"),
                    textOrNull(node, "user_agent"),
                    doubleOr(node, "duration_sec", 0.0)
            ));
        } catch (Exception ex) {
            log.warn("LogLineParser: skipping malformed line ({}): {}",
                    ex.getClass().getSimpleName(),
                    line.length() > 200 ? line.substring(0, 200) + "..." : line);
            return Optional.empty();
        }
    }

    private static String textOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static int intOr(JsonNode node, String field, int dflt) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? dflt : v.asInt(dflt);
    }

    private static long longOr(JsonNode node, String field, long dflt) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? dflt : v.asLong(dflt);
    }

    private static double doubleOr(JsonNode node, String field, double dflt) {
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) return dflt;
        try {
            return Double.parseDouble(v.asText());
        } catch (NumberFormatException nfe) {
            return dflt;
        }
    }

    private static Instant parseTime(String iso) {
        try {
            return OffsetDateTime.parse(iso).toInstant();
        } catch (Exception ex) {
            return Instant.now();
        }
    }

    /** Subset of nginx log fields the shipper actually uses. */
    public record LogLineEvent(
            String downloadId,
            String type,                 // "DOWNLOAD" | "ONLINE"
            Instant time,
            String requestId,
            int status,
            long bytesSent,
            String contentRange,         // "bytes a-b/total" or null/""
            String realIp,
            String userAgent,
            double durationSec
    ) {}
}
