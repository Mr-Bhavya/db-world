package com.db.dbworld.app.system.health;

import com.db.dbworld.app.system.health.dto.HostHealthReport;
import com.db.dbworld.app.system.health.dto.HostHealthReport.Check;
import com.db.dbworld.app.system.health.dto.HostHealthReport.Counts;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AccessDeniedException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Reads the host health report that {@code dbworldctl doctor --json} leaves on disk.
 *
 * <p>The checks themselves run as root on the host (SMART, systemd units, certificates, backups),
 * which this app cannot and should not do from inside its own service user. The doctor writes its
 * findings to a file and this class only reads it, so the app needs no extra privilege.
 *
 * <p>Nothing here throws for a bad file. A missing file is the normal state of a dev box, and a
 * corrupt one is a host problem to report, not a reason to fail the System Info page. Either way
 * the caller gets an "unavailable" report carrying the reason.
 *
 * <p>Parsing walks the JSON tree by hand instead of binding to a class. The file is produced by a
 * shell script on another release cycle, so unknown fields are ignored, missing optional fields
 * get defaults, and a single malformed check is skipped without losing the rest of the report.
 */
@Log4j2
@Service
@EnableConfigurationProperties(HostHealthProperties.class)
public class HostHealthService {

    static final String DEFAULT_REPORT_PATH = "/var/lib/dbworld/health/doctor.json";

    /** What the doctor timer is set to. Used when the report does not say. */
    static final long DEFAULT_INTERVAL_SECONDS = 900;

    /** Slack on top of two missed runs before a report counts as stale: timers drift a little. */
    static final long STALE_GRACE_SECONDS = 60;

    /** A real report is a few KB. Anything near this size is not a report, so don't load it. */
    static final long MAX_REPORT_BYTES = 1_048_576;

    /**
     * Private mapper, not the injected bean: Spring Boot 4 ships Jackson 3 and exposes no
     * {@code com.fasterxml.jackson.databind.ObjectMapper} bean (see {@code JacksonBeanWiringTest}),
     * and this only ever reads a tree, so none of the app's customisations apply.
     */
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final Path reportPath;
    private final Clock clock;

    @Autowired
    public HostHealthService(HostHealthProperties properties) {
        this(resolvePath(properties.reportPath()), Clock.systemUTC());
    }

    HostHealthService(Path reportPath, Clock clock) {
        this.reportPath = reportPath;
        this.clock = clock;
    }

    private static Path resolvePath(String configured) {
        // An env placeholder left empty binds as "", which would resolve to the working directory.
        return Path.of(configured == null || configured.isBlank() ? DEFAULT_REPORT_PATH : configured.trim());
    }

    /** The current report, or an "unavailable" one saying why there is none. Never throws. */
    public HostHealthReport read() {
        String where = reportPath.toString();
        try {
            long size = Files.size(reportPath);
            if (size > MAX_REPORT_BYTES) {
                return HostHealthReport.unavailable(where,
                        "The health report at " + where + " is " + size + " bytes, too large to be a real report.");
            }
            String json = Files.readString(reportPath, StandardCharsets.UTF_8);
            Instant modified = Files.getLastModifiedTime(reportPath).toInstant();
            return parse(json, modified);
        } catch (NoSuchFileException e) {
            return HostHealthReport.unavailable(where, "No health report at " + where + ".");
        } catch (AccessDeniedException e) {
            return HostHealthReport.unavailable(where,
                    "The health report at " + where + " is not readable by the app's user. It should be mode 0644.");
        } catch (IOException | RuntimeException e) {
            log.debug("Could not read host health report {}: {}", where, e.toString());
            return HostHealthReport.unavailable(where,
                    "Could not read the health report at " + where + ": " + firstLine(e.getMessage()));
        }
    }

    /**
     * Parses report content. {@code fileModified} is the fallback clock for the report's age when
     * the doctor did not write a usable timestamp: the file is replaced atomically on every run,
     * so its modification time is when that run finished.
     */
    HostHealthReport parse(String json, Instant fileModified) {
        String where = reportPath.toString();
        if (json == null || json.isBlank()) {
            return HostHealthReport.unavailable(where, "The health report at " + where + " is empty.");
        }

        JsonNode root;
        try {
            root = MAPPER.readTree(json);
        } catch (JacksonException e) {
            return HostHealthReport.unavailable(where,
                    "The health report at " + where + " is not valid JSON: " + firstLine(e.getOriginalMessage()));
        }
        if (root == null || !root.isObject()) {
            return HostHealthReport.unavailable(where, "The health report at " + where + " is not a JSON object.");
        }

        List<Check> checks = parseChecks(root.get("checks"));

        Long interval = longOrNull(root, "intervalSeconds");
        long intervalSeconds = interval != null && interval > 0 ? interval : DEFAULT_INTERVAL_SECONDS;

        Long epoch = longOrNull(root, "generatedAtEpoch");
        String generatedAt = text(root, "generatedAt");
        Instant generated = generatedInstant(epoch, generatedAt, fileModified);
        // A host clock slightly ahead of this one would give a negative age. "Just now" is the
        // honest reading of that; it must not count as fresher than fresh.
        long ageSeconds = Math.max(0, clock.instant().getEpochSecond() - generated.getEpochSecond());
        boolean stale = ageSeconds > 2 * intervalSeconds + STALE_GRACE_SECONDS;

        Long version = longOrNull(root, "version");
        return new HostHealthReport(
                true,
                null,
                stale,
                ageSeconds,
                where,
                version == null ? null : version.intValue(),
                text(root, "host"),
                generatedAt.isEmpty() ? null : generatedAt,
                epoch,
                intervalSeconds,
                overall(text(root, "overall"), checks),
                counts(root.get("counts"), checks),
                checks);
    }

    private static Instant generatedInstant(Long epoch, String generatedAt, Instant fileModified) {
        if (epoch != null && epoch > 0) return Instant.ofEpochSecond(epoch);
        if (!generatedAt.isEmpty()) {
            try {
                return OffsetDateTime.parse(generatedAt).toInstant();
            } catch (DateTimeParseException ignored) {
                // Fall through to the file's own timestamp.
            }
        }
        return fileModified != null ? fileModified : Instant.EPOCH;
    }

    private static List<Check> parseChecks(JsonNode node) {
        if (node == null || !node.isArray()) return List.of();
        List<Check> checks = new ArrayList<>();
        int index = 0;
        for (JsonNode c : node.values()) {
            index++;
            if (c == null || !c.isObject()) continue;
            String group = text(c, "group");
            String name = text(c, "name");
            String id = text(c, "id");
            if (id.isEmpty()) id = fallbackId(group, name, index);
            checks.add(new Check(
                    id,
                    group.isEmpty() ? "System" : group,
                    name.isEmpty() ? id : name,
                    HostHealthStatus.parse(text(c, "status")).wire(),
                    text(c, "value"),
                    text(c, "detail"),
                    text(c, "hint")));
        }
        return List.copyOf(checks);
    }

    /**
     * An id for a check the doctor wrote without one. Built from group and name rather than the
     * position, so the same check keeps the same id from run to run and alerting does not see a
     * "new" failure every time the list is reordered.
     */
    private static String fallbackId(String group, String name, int index) {
        String base = (group + "." + name).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9.]+", "_");
        return base.replace(".", "").replace("_", "").isEmpty() ? "check." + index : base;
    }

    /** The file's own verdict when it gives one; otherwise the worst check, as the doctor would. */
    private static String overall(String raw, List<Check> checks) {
        if (!raw.isEmpty()) return HostHealthStatus.parse(raw).wire();
        HostHealthStatus worst = checks.isEmpty() ? HostHealthStatus.UNKNOWN : HostHealthStatus.OK;
        for (Check c : checks) {
            HostHealthStatus s = HostHealthStatus.parse(c.status());
            if (s.severity() > worst.severity()) worst = s;
        }
        return worst.wire();
    }

    /** The file's counts when present; otherwise counted from the checks so the UI always has some. */
    private static Counts counts(JsonNode node, List<Check> checks) {
        if (node != null && node.isObject()) {
            return new Counts(intOr(node, "ok"), intOr(node, "warn"), intOr(node, "fail"), intOr(node, "unknown"));
        }
        int ok = 0, warn = 0, fail = 0, unknown = 0;
        for (Check c : checks) {
            switch (HostHealthStatus.parse(c.status())) {
                case OK      -> ok++;
                case WARN    -> warn++;
                case FAIL    -> fail++;
                case UNKNOWN -> unknown++;
            }
        }
        return new Counts(ok, warn, fail, unknown);
    }

    // ── Lenient field readers ─────────────────────────────────────────────────

    /** A scalar as text, trimmed; "" for missing, null, objects and arrays. */
    private static String text(JsonNode n, String field) {
        JsonNode v = n.get(field);
        if (v == null || v.isNull() || v.isContainer()) return "";
        String s = v.isString() ? v.stringValue() : v.asString("");
        return s == null ? "" : s.trim();
    }

    /** A whole number from a JSON number or a numeric string; null when neither. */
    private static Long longOrNull(JsonNode n, String field) {
        JsonNode v = n.get(field);
        if (v == null || v.isNull()) return null;
        if (v.isNumber()) return v.numberValue().longValue();
        if (v.isString()) {
            try {
                return Long.parseLong(v.stringValue().trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private static int intOr(JsonNode n, String field) {
        Long v = longOrNull(n, field);
        return v == null ? 0 : (int) Math.max(0, Math.min(Integer.MAX_VALUE, v));
    }

    private static String firstLine(String message) {
        if (message == null || message.isBlank()) return "unknown error";
        int nl = message.indexOf('\n');
        return (nl < 0 ? message : message.substring(0, nl)).trim();
    }
}
