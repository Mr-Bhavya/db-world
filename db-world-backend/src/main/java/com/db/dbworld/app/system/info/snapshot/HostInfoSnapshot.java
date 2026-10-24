package com.db.dbworld.app.system.info.snapshot;

import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AccessDeniedException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.FileTime;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

/**
 * The host's own System Info readings, for when this app runs inside a container.
 *
 * <p>The collectors were written for a backend running straight on the Pi: they run
 * {@code vcgencmd}, {@code systemctl}, {@code dpkg-query} and friends, and read host files such
 * as {@code /etc/os-release} and {@code /proc/device-tree/model}. In a container those describe
 * the container instead (or are not installed at all), and Docker masks the device tree. So a
 * root timer on the host runs the same commands every minute and writes what they printed to
 * {@code /run/dbworld/host-info.json}, mounted read-only into the container. In container mode
 * the collectors answer from that file and never start a process.
 *
 * <p>Only what the container cannot see for itself is in the file. The /proc and /sys
 * pseudo-files the kernel shares with the container (meminfo, stat, loadavg, net/dev, thermal
 * zones) are not, so the fast-moving numbers keep being read live instead of up to a minute old.
 *
 * <p>Host mode (the default) never opens the file: every lookup is empty and the collectors
 * behave exactly as they always have. In container mode a missing, unreadable, unparseable or
 * stale file is treated as no snapshot at all: commands read as "not available" and files fall
 * back to the live filesystem. Nothing here throws.
 *
 * <p>The file is re-parsed only when its modification time or size changes, and that is looked
 * at no more than once a second, so the forty-odd lookups of one collection cost one {@code stat}.
 */
@Log4j2
@Component
public class HostInfoSnapshot {

    static final String DEFAULT_PATH = "/run/dbworld/host-info.json";

    /** The contract version this reader understands. A file that states no version is read as this one. */
    static final long SUPPORTED_VERSION = 1;

    /** Ten missed runs of the 60 s timer. Past this the host data is too old to pass off as current. */
    static final long STALE_AFTER_SECONDS = 600;

    /** How often the file's modification time is looked at. Lookups in between reuse the last parse. */
    static final long RELOAD_CHECK_MILLIS = 1_000;

    /** The package list is most of a real snapshot, a few MB at most. Anything this big is not one. */
    static final long MAX_SNAPSHOT_BYTES = 32L * 1024 * 1024;

    /**
     * Private mapper, not the injected bean, for the same reason as {@code HostHealthService}:
     * Spring Boot 4 exposes no Jackson 2 {@code ObjectMapper} bean, and this only reads a tree.
     */
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final HostInfoSnapshot DISABLED =
            new HostInfoSnapshot(false, Path.of(DEFAULT_PATH), Clock.systemUTC());

    /** One command the host ran: the exact argv, its exit code and everything it wrote to stdout. */
    public record CommandResult(List<String> argv, int exit, String stdout, Instant capturedAt) {}

    /** statvfs(2) of one host mount point, in bytes. {@code freeBytes} includes root-reserved blocks. */
    public record StatVfs(long totalBytes, long freeBytes, long availableBytes, boolean readOnly) {}

    /** One parsed file. */
    private record Contents(String host,
                            Instant generatedAt,
                            Map<List<String>, CommandResult> commands,
                            Map<String, String> files,
                            Map<String, Boolean> exists,
                            Map<String, StatVfs> statvfs) {}

    /**
     * What the last look at the file found. {@code contents} is null when it gave nothing usable;
     * {@code modified} is null when there was no file to look at, so the next look reads it again.
     */
    private record Loaded(FileTime modified, long size, Contents contents) {
        static final Loaded NOTHING = new Loaded(null, -1, null);
    }

    /** Why the snapshot is not in use. Tracked so each episode is logged once, not on every lookup. */
    private enum Problem { MISSING, UNREADABLE, INVALID, STALE }

    private static final class InvalidSnapshotException extends Exception {
        InvalidSnapshotException(String message) {
            super(message);
        }
    }

    private final boolean containerMode;
    private final Path path;
    private final Clock clock;

    private volatile Loaded loaded;
    private volatile long lastCheckedMillis;
    private final AtomicReference<Problem> reported = new AtomicReference<>();

    @Autowired
    public HostInfoSnapshot(@Value("${dbworld.runtime:host}") String runtime,
                            @Value("${dbworld.host-info.path:" + DEFAULT_PATH + "}") String path) {
        this(isContainerRuntime(runtime), resolvePath(path), Clock.systemUTC());
        if (containerMode) {
            log.info("Container runtime: System Info answers host commands and files from {}", this.path);
        }
    }

    /** For tests and wiring without Spring. With {@code containerMode=false} the file is never read. */
    public HostInfoSnapshot(boolean containerMode, Path path, Clock clock) {
        this.containerMode = containerMode;
        this.path = path;
        this.clock = clock;
    }

    /** Host mode: a snapshot that is never read. What collectors built without Spring get. */
    public static HostInfoSnapshot disabled() {
        return DISABLED;
    }

    static boolean isContainerRuntime(String runtime) {
        String value = runtime == null ? "" : runtime.trim().toLowerCase(Locale.ROOT);
        return switch (value) {
            case "container" -> true;
            case "", "host" -> false;
            default -> {
                log.warn("Unknown dbworld.runtime '{}': expected host or container. Running as host.", runtime);
                yield false;
            }
        };
    }

    private static Path resolvePath(String configured) {
        // An env placeholder left empty binds as "", which would resolve to the working directory.
        return Path.of(configured == null || configured.isBlank() ? DEFAULT_PATH : configured.trim());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Lookups. All empty in host mode and whenever there is no fresh snapshot.
    // ──────────────────────────────────────────────────────────────────────────

    /** Whether the collectors must answer from the snapshot instead of running anything. */
    public boolean containerMode() {
        return containerMode;
    }

    /** True while a fresh snapshot is in use. Always false in host mode. */
    public boolean active() {
        return current() != null;
    }

    /** When the snapshot in use was generated on the host. */
    public Optional<Instant> generatedAt() {
        return Optional.ofNullable(current()).map(Contents::generatedAt);
    }

    /** What the host's run of exactly this argv produced, matched element by element. */
    public Optional<CommandResult> command(List<String> argv) {
        Contents c = current();
        return c == null || argv == null ? Optional.empty() : Optional.ofNullable(c.commands().get(argv));
    }

    /** The host's content of this absolute path, as text, untrimmed. */
    public Optional<String> file(String absolutePath) {
        Contents c = current();
        return c == null || absolutePath == null ? Optional.empty() : Optional.ofNullable(c.files().get(absolutePath));
    }

    /** Whether this absolute path exists on the host, when the snapshot says. */
    public Optional<Boolean> exists(String absolutePath) {
        Contents c = current();
        return c == null || absolutePath == null ? Optional.empty() : Optional.ofNullable(c.exists().get(absolutePath));
    }

    /** The host's statvfs of this mount point, keyed exactly as lsblk reports it. */
    public Optional<StatVfs> statvfs(String mountPoint) {
        Contents c = current();
        return c == null || mountPoint == null ? Optional.empty() : Optional.ofNullable(c.statvfs().get(mountPoint));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Loading
    // ──────────────────────────────────────────────────────────────────────────

    /** The snapshot to answer from, or null: host mode, no usable file, or a stale one. */
    private Contents current() {
        if (!containerMode) return null;
        try {
            Contents contents = reloadIfDue().contents();
            if (contents == null) return null;

            // A host clock slightly ahead of this one gives a negative age, which is just "fresh".
            long ageSeconds = clock.instant().getEpochSecond() - contents.generatedAt().getEpochSecond();
            if (ageSeconds > STALE_AFTER_SECONDS) {
                report(Problem.STALE, "Host info snapshot {} is stale: generated {} s ago, limit {} s. "
                        + "Host commands read as unavailable until the host writes a fresh one.",
                        path, ageSeconds, STALE_AFTER_SECONDS);
                return null;
            }
            if (reported.getAndSet(null) != null) {
                log.info("Host info snapshot {} is in use again (generated {})", path, contents.generatedAt());
            }
            return contents;
        } catch (RuntimeException e) {
            log.debug("Host info snapshot lookup failed: {}", e.toString());
            return null;
        }
    }

    private Loaded reloadIfDue() {
        long now = clock.millis();
        Loaded seen = loaded;
        if (seen != null && Math.abs(now - lastCheckedMillis) < RELOAD_CHECK_MILLIS) return seen;
        synchronized (this) {
            if (loaded == null || Math.abs(now - lastCheckedMillis) >= RELOAD_CHECK_MILLIS) {
                lastCheckedMillis = now;
                loaded = refresh(loaded);
            }
            return loaded;
        }
    }

    /** Re-reads the file when it changed since {@code previous}; otherwise hands {@code previous} back. */
    private Loaded refresh(Loaded previous) {
        BasicFileAttributes attributes;
        try {
            attributes = Files.readAttributes(path, BasicFileAttributes.class);
        } catch (NoSuchFileException e) {
            report(Problem.MISSING, "No host info snapshot at {}. Host commands read as unavailable "
                    + "until the host writes one.", path);
            return Loaded.NOTHING;
        } catch (IOException | RuntimeException e) {
            report(Problem.UNREADABLE, "Cannot read host info snapshot {}: {}", path, e.toString());
            return Loaded.NOTHING;
        }

        FileTime modified = attributes.lastModifiedTime();
        long size = attributes.size();
        if (previous != null && modified.equals(previous.modified()) && size == previous.size()) return previous;

        if (size > MAX_SNAPSHOT_BYTES) {
            report(Problem.INVALID, "Host info snapshot {} is {} bytes, too large to be a real snapshot.", path, size);
            return new Loaded(modified, size, null);
        }

        String json;
        try {
            json = Files.readString(path, StandardCharsets.UTF_8);
        } catch (AccessDeniedException e) {
            report(Problem.UNREADABLE, "Host info snapshot {} is not readable by the app's user. "
                    + "It should be mode 0644.", path);
            return Loaded.NOTHING;
        } catch (IOException | RuntimeException e) {
            // Includes the file being swapped out between the stat and the read: look again next time.
            report(Problem.UNREADABLE, "Cannot read host info snapshot {}: {}", path, e.toString());
            return Loaded.NOTHING;
        }

        try {
            Contents contents = parse(json, modified.toInstant());
            log.debug("Loaded host info snapshot {}: host {}, generated {}, {} commands, {} files",
                    path, contents.host(), contents.generatedAt(), contents.commands().size(), contents.files().size());
            return new Loaded(modified, size, contents);
        } catch (InvalidSnapshotException e) {
            // Remembered with its timestamp, so an unchanged broken file is not re-parsed every second.
            report(Problem.INVALID, "Host info snapshot {} is unusable: {}", path, e.getMessage());
            return new Loaded(modified, size, null);
        }
    }

    private void report(Problem problem, String message, Object... args) {
        if (reported.getAndSet(problem) != problem) log.warn(message, args);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Parsing. Lenient per entry: one malformed entry is dropped, the rest kept.
    // ──────────────────────────────────────────────────────────────────────────

    private static Contents parse(String json, Instant fileModified) throws InvalidSnapshotException {
        if (json == null || json.isBlank()) throw new InvalidSnapshotException("the file is empty");

        JsonNode root;
        try {
            root = MAPPER.readTree(json);
        } catch (JacksonException e) {
            throw new InvalidSnapshotException("not valid JSON: " + firstLine(e.getOriginalMessage()));
        }
        if (root == null || !root.isObject()) throw new InvalidSnapshotException("not a JSON object");

        Long version = longOrNull(root, "version");
        if (version != null && version != SUPPORTED_VERSION) {
            throw new InvalidSnapshotException("version " + version + " is not supported (expected " + SUPPORTED_VERSION + ")");
        }

        return new Contents(
                text(root, "host"),
                generatedInstant(longOrNull(root, "generatedAtEpoch"), text(root, "generatedAt"), fileModified),
                commands(root.get("commands")),
                files(root.get("files")),
                exists(root.get("exists")),
                statvfs(root.get("statvfs")));
    }

    private static Instant generatedInstant(Long epoch, String generatedAt, Instant fileModified) {
        if (epoch != null && epoch > 0) return Instant.ofEpochSecond(epoch);
        if (!generatedAt.isEmpty()) {
            try {
                return OffsetDateTime.parse(generatedAt).toInstant();
            } catch (DateTimeParseException ignored) {
                // Fall through to the file's own timestamp: it is replaced atomically on every run.
            }
        }
        return fileModified != null ? fileModified : Instant.EPOCH;
    }

    private static Map<List<String>, CommandResult> commands(JsonNode node) {
        if (node == null || !node.isArray()) return Map.of();
        Map<List<String>, CommandResult> out = new HashMap<>();
        for (JsonNode c : node.values()) {
            if (c == null || !c.isObject()) continue;
            List<String> argv = argv(c.get("argv"));
            if (argv == null) continue; // nothing could ever match it
            Long exit = longOrNull(c, "exit");
            JsonNode stdout = c.get("stdout");
            Long captured = longOrNull(c, "capturedAtEpoch");
            out.put(argv, new CommandResult(
                    argv,
                    // No exit code is no evidence it ran: read it as a failure, not as output.
                    exit == null ? -1 : (int) Math.max(Integer.MIN_VALUE, Math.min(Integer.MAX_VALUE, exit)),
                    stdout != null && stdout.isString() ? stdout.stringValue() : "",
                    captured == null || captured <= 0 ? null : Instant.ofEpochSecond(captured)));
        }
        return Map.copyOf(out);
    }

    /** A non-empty array of strings, or null. A single non-string element voids the whole argv. */
    private static List<String> argv(JsonNode node) {
        if (node == null || !node.isArray() || node.isEmpty()) return null;
        List<String> argv = new ArrayList<>(node.size());
        for (JsonNode a : node.values()) {
            if (a == null || !a.isString()) return null;
            argv.add(a.stringValue());
        }
        return List.copyOf(argv);
    }

    private static Map<String, String> files(JsonNode node) {
        if (node == null || !node.isObject()) return Map.of();
        Map<String, String> out = new HashMap<>();
        for (Map.Entry<String, JsonNode> e : node.properties()) {
            JsonNode v = e.getValue();
            if (v != null && v.isString()) out.put(e.getKey(), v.stringValue());
        }
        return Map.copyOf(out);
    }

    private static Map<String, Boolean> exists(JsonNode node) {
        if (node == null || !node.isObject()) return Map.of();
        Map<String, Boolean> out = new HashMap<>();
        for (Map.Entry<String, JsonNode> e : node.properties()) {
            Boolean flag = booleanOrNull(e.getValue());
            if (flag != null) out.put(e.getKey(), flag);
        }
        return Map.copyOf(out);
    }

    private static Map<String, StatVfs> statvfs(JsonNode node) {
        if (node == null || !node.isObject()) return Map.of();
        Map<String, StatVfs> out = new HashMap<>();
        for (Map.Entry<String, JsonNode> e : node.properties()) {
            JsonNode v = e.getValue();
            if (v == null || !v.isObject()) continue;
            Long total = longOrNull(v, "totalBytes");
            Long free = longOrNull(v, "freeBytes");
            if (total == null || free == null || total < 0 || free < 0) continue;
            Long available = longOrNull(v, "availableBytes");
            out.put(e.getKey(), new StatVfs(total, free,
                    available == null ? free : available,
                    Boolean.TRUE.equals(booleanOrNull(v.get("readOnly")))));
        }
        return Map.copyOf(out);
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

    /** A JSON boolean, or the strings "true"/"false"; null for anything else. */
    private static Boolean booleanOrNull(JsonNode v) {
        if (v == null || v.isNull()) return null;
        if (v.isBoolean()) return v.booleanValue();
        if (v.isString()) {
            String s = v.stringValue().trim();
            if (s.equalsIgnoreCase("true")) return true;
            if (s.equalsIgnoreCase("false")) return false;
        }
        return null;
    }

    private static String firstLine(String message) {
        if (message == null || message.isBlank()) return "unknown error";
        int nl = message.indexOf('\n');
        return (nl < 0 ? message : message.substring(0, nl)).trim();
    }
}
