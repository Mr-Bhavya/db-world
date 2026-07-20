package com.db.dbworld.audit.tracking.parse;

import com.db.dbworld.audit.tracking.enums.ActivityKind;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Log4j2
@Component
@RequiredArgsConstructor
public class CdnLogLineParser {

    // "bytes 0-1023/10000"  or  "bytes 0-1023/*"
    private static final Pattern RANGE = Pattern.compile("bytes\\s+(\\d+)-(\\d+)/(\\d+|\\*)");

    private final ObjectMapper objectMapper;

    public Optional<CdnLogLine> parse(String line) {
        if (line == null || line.isBlank()) return Optional.empty();
        try {
            JsonNode n = objectMapper.readTree(line);

            String requestId = text(n, "request_id");
            String type = text(n, "type");
            if (requestId == null || requestId.isBlank()) return Optional.empty();
            ActivityKind activity;
            if ("DOWNLOAD".equals(type))      activity = ActivityKind.DOWNLOAD;
            else if ("ONLINE".equals(type))   activity = ActivityKind.STREAM;
            else return Optional.empty();

            Long rs = null, re = null, total = null;
            String cr = text(n, "content_range");
            if (cr != null) {
                Matcher m = RANGE.matcher(cr);
                if (m.find()) {
                    rs = Long.parseLong(m.group(1));
                    re = Long.parseLong(m.group(2));
                    total = "*".equals(m.group(3)) ? null : Long.parseLong(m.group(3));
                }
            }

            String t = text(n, "time");
            Instant time = t != null ? OffsetDateTime.parse(t).toInstant() : Instant.now();

            return Optional.of(new CdnLogLine(
                    requestId, activity, time,
                    intOr(n, "status", 0), longOr(n, "bytes_sent", 0L),
                    rs, re, total,
                    text(n, "real_ip"), text(n, "user_agent"),
                    doubleOr(n, "duration_sec", 0.0), longObj(n, "conn")
            ));
        } catch (Exception ex) {
            log.debug("CdnLogLineParser: skipping malformed line: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    private static String text(JsonNode n, String f) {
        JsonNode v = n.get(f);
        return (v == null || v.isNull()) ? null : v.asText();
    }
    private static int intOr(JsonNode n, String f, int d) {
        JsonNode v = n.get(f); return v == null || v.isNull() ? d : v.asInt(d);
    }
    private static long longOr(JsonNode n, String f, long d) {
        JsonNode v = n.get(f); return v == null || v.isNull() ? d : v.asLong(d);
    }
    private static Long longObj(JsonNode n, String f) {
        JsonNode v = n.get(f);
        if (v == null || v.isNull() || v.asText().isBlank()) return null;
        try { return Long.parseLong(v.asText().trim()); } catch (NumberFormatException e) { return null; }
    }
    private static double doubleOr(JsonNode n, String f, double d) {
        JsonNode v = n.get(f);
        if (v == null || v.isNull()) return d;
        try { return Double.parseDouble(v.asText()); } catch (NumberFormatException e) { return d; }
    }
}
