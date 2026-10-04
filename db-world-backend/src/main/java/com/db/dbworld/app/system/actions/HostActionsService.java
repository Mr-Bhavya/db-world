package com.db.dbworld.app.system.actions;

import com.db.dbworld.app.system.actions.HostActionValidator.PowerPlan;
import com.db.dbworld.app.system.actions.HostActionValidator.Validated;
import com.db.dbworld.app.system.actions.dto.HostActionResult;
import com.db.dbworld.app.system.actions.dto.HostActionSubmitted;
import com.db.dbworld.app.system.actions.dto.HostActionsList;
import com.db.dbworld.app.system.actions.dto.HostPowerState;
import com.db.dbworld.app.system.actions.dto.HostPowerState.Scheduled;
import com.db.dbworld.app.system.actions.dto.HostPowerState.WakeAlarm;
import com.db.dbworld.app.system.health.HostHealthService;
import com.db.dbworld.app.system.health.alert.HostHealthMonitor;
import com.db.dbworld.app.system.health.dto.HostHealthReport;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.push.PushService;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AccessDeniedException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * The app's side of the host action broker: queues requests for {@code dbworldctl} and reads back
 * what happened to them.
 *
 * <p>The app runs as an unprivileged user and must never run sudo or a shell. Instead it drops a
 * JSON request into {@code requests/}; a root systemd path unit on the Pi picks it up within about
 * a second, {@code dbworldctl} checks it against an allowlist and runs it, and the outcome lands in
 * {@code results/<id>.json}. So the worst this class can do is write a file that root then refuses.
 *
 * <p>Requests are written atomically (a dot-prefixed temp file, then a rename), so the host never
 * sees half a request: it ignores any name that is not {@code <uuid>.json}.
 *
 * <p>Reading is lenient in the same way as {@link HostHealthService}: the results are written by a
 * shell script on another release cycle, so unknown fields are ignored, missing ones defaulted,
 * and one unreadable result is shown as such instead of failing the list. A server without the
 * broker (every dev box) reports "unavailable" rather than erroring.
 */
@Log4j2
@Service
@EnableConfigurationProperties(HostActionsProperties.class)
public class HostActionsService {

    static final String DEFAULT_DIR = "/var/lib/dbworld/actions";
    static final String DEFAULT_ZONE = "Asia/Kolkata";
    static final int SCHEMA_VERSION = 1;

    /** Results kept in the list. The host deletes results after 14 days anyway. */
    static final int MAX_RESULTS = 50;

    /** A result holds ~200 lines of output and power.json is tiny; anything near this is not ours. */
    static final long MAX_FILE_BYTES = 1_048_576;

    /** The host picks requests up within a second or so; one still waiting after this is stuck. */
    static final Duration STUCK_AFTER = Duration.ofMinutes(2);

    /** The host's own filter. Anything else in the spool, including our temp files, is not a request. */
    private static final Pattern FILE_NAME = Pattern.compile("[0-9a-f-]{36}\\.json");
    private static final Pattern ID = Pattern.compile("[0-9a-f-]{36}");
    private static final Set<String> RESULT_STATUSES = Set.of("running", "done", "failed", "rejected");
    private static final DateTimeFormatter ISO_SECONDS = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    /**
     * Private mapper, not the injected bean: Spring Boot 4 ships Jackson 3 and exposes no
     * {@code com.fasterxml.jackson.databind.ObjectMapper} bean, and the spool files have their own
     * fixed shape that none of the app's customisations should touch.
     */
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final Path dir;
    private final Path requestsDir;
    private final Path resultsDir;
    private final Path powerFile;
    private final ZoneId zone;
    private final Clock clock;
    private final HostHealthService healthService;
    private final PushService pushService;
    private final HostActionValidator validator;

    /** Makes "no other power request is queued" and the write one step, for admins clicking at once. */
    private final ReentrantLock submitLock = new ReentrantLock();

    @Autowired
    public HostActionsService(HostActionsProperties properties, HostHealthService healthService,
                              PushService pushService) {
        this(resolveDir(properties.dir()), resolveZone(properties.zone()), Clock.systemUTC(),
                healthService, pushService);
    }

    HostActionsService(Path dir, ZoneId zone, Clock clock, HostHealthService healthService,
                       PushService pushService) {
        this.dir = dir;
        this.requestsDir = dir.resolve("requests");
        this.resultsDir = dir.resolve("results");
        this.powerFile = dir.resolve("power.json");
        this.zone = zone;
        this.clock = clock;
        this.healthService = healthService;
        this.pushService = pushService;
        this.validator = new HostActionValidator(clock, zone);
    }

    private static Path resolveDir(String configured) {
        // An env placeholder left empty binds as "", which would resolve to the working directory.
        return Path.of(configured == null || configured.isBlank() ? DEFAULT_DIR : configured.trim());
    }

    private static ZoneId resolveZone(String configured) {
        if (configured == null || configured.isBlank()) return ZoneId.of(DEFAULT_ZONE);
        try {
            return ZoneId.of(configured.trim());
        } catch (DateTimeException e) {
            log.warn("dbworld.host-actions.zone '{}' is not a time zone; using {}", configured, DEFAULT_ZONE);
            return ZoneId.of(DEFAULT_ZONE);
        }
    }

    // ── Submit ───────────────────────────────────────────────────────────────

    /**
     * Validates a request and puts it in the host's queue.
     *
     * @throws DbWorldException 400 for a request that breaks a rule, 409 while another power
     *                          request is still queued or when a power action cannot be confirmed,
     *                          503 where there is no broker or the queue is not writable
     */
    public HostActionSubmitted submit(String action, Map<String, Object> args, String confirm, String requestedBy) {
        String unavailable = unavailableReason();
        if (unavailable != null) {
            throw new DbWorldException(HttpStatus.SERVICE_UNAVAILABLE, unavailable);
        }

        Validated request = validator.validate(action, args, confirm, this::confirmHostName);
        String by = requestedBy == null || requestedBy.isBlank() ? "admin" : requestedBy.trim();
        String id = UUID.randomUUID().toString();

        submitLock.lock();
        try {
            if (request.action().isPower()) refuseWhilePowerQueued();
            writeRequest(id, request, by);
        } finally {
            submitLock.unlock();
        }

        // The app's own audit trail; the host keeps its own of what it actually ran.
        log.info("Host action {} queued by {}: {} args={}", id, by, request.action().wire(), request.args());
        if (request.action().announcesToAdmins()) announce(request, by);
        return HostActionSubmitted.queued(id);
    }

    /**
     * Two reboots racing through the queue, or a cancel overtaken by the reboot it meant to stop,
     * are exactly the mix-ups a remote power button must not allow. The host drains the queue in
     * about a second, so in practice this only bites on a double click, or when the host side
     * is down and nothing is being picked up at all.
     */
    private void refuseWhilePowerQueued() {
        for (Item queued : queued()) {
            HostActionResult q = queued.result();
            if (q.action().startsWith("power-")) {
                throw new DbWorldException(HttpStatus.CONFLICT,
                        "Another power request (" + q.action() + (q.requestedBy() == null ? "" : " by " + q.requestedBy())
                                + ") is still waiting for the host to pick it up. Try again in a moment.");
            }
        }
    }

    private void writeRequest(String id, Validated request, String by) {
        ObjectNode root = MAPPER.createObjectNode();
        root.put("version", SCHEMA_VERSION);
        root.put("id", id);
        root.put("action", request.action().wire());
        ObjectNode args = root.putObject("args");
        request.args().forEach((name, value) -> {
            if (value instanceof List<?> list) {
                ArrayNode array = args.putArray(name);
                list.forEach(item -> array.add(String.valueOf(item)));
            } else {
                args.put(name, String.valueOf(value));
            }
        });
        root.put("confirm", request.confirm());
        root.put("requestedBy", by);
        // Formatted explicitly: OffsetDateTime.toString() drops ":00" seconds, and the host's
        // parser should not have to cope with two shapes.
        root.put("requestedAt", ISO_SECONDS.format(
                OffsetDateTime.now(clock.withZone(zone)).truncatedTo(ChronoUnit.SECONDS)));

        Path tmp = requestsDir.resolve("." + id + ".tmp");
        Path target = requestsDir.resolve(id + ".json");
        try {
            Files.writeString(tmp, MAPPER.writeValueAsString(root) + "\n", StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
            // A rename within one directory: the path unit sees either no request or the whole one.
            Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE);
        } catch (AccessDeniedException e) {
            deleteQuietly(tmp);
            throw new DbWorldException(HttpStatus.SERVICE_UNAVAILABLE,
                    "The app cannot write to " + requestsDir + ". It should be group-writable for dbworld.");
        } catch (IOException | RuntimeException e) {
            deleteQuietly(tmp);
            log.warn("Could not queue host action {}: {}", request.action().wire(), e.toString());
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Could not queue the action: " + firstLine(e.getMessage()));
        }
    }

    // ── Push ─────────────────────────────────────────────────────────────────

    /** A phone notification's text. */
    record PushMessage(String title, String body) {}

    /**
     * Every admin hears about a reboot, shutdown or cancel when it is queued, not when it happens:
     * after a "reboot now" the app is not around to say so, and a scheduled one is exactly what
     * another admin would want to know about before it takes the site down.
     */
    private void announce(Validated request, String by) {
        PushMessage message = pushMessage(request, by, ZonedDateTime.now(clock.withZone(zone)));
        if (message == null) return;
        try {
            pushService.broadcastToAdmins(message.title(), message.body(),
                    HostHealthMonitor.DEEP_LINK, HostHealthMonitor.CHANNEL);
        } catch (Exception e) {
            // The request is already queued; a push that fails must not make it look like it was not.
            log.warn("Host action push '{}' failed: {}", message.title(), e.toString());
        }
    }

    static PushMessage pushMessage(Validated request, String by, ZonedDateTime now) {
        PowerPlan plan = request.plan();
        return switch (request.action()) {
            case POWER_REBOOT -> plan.immediate()
                    ? new PushMessage("Server rebooting", "Reboot now, requested by " + by)
                    : new PushMessage("Server reboot scheduled",
                            "Reboot scheduled for " + HostActionValidator.describe(plan.at(), now) + " by " + by);
            case POWER_SHUTDOWN -> new PushMessage("Server shutdown scheduled",
                    (plan.immediate() ? "Shutdown now" : "Shutdown at " + HostActionValidator.describe(plan.at(), now))
                            + ", back on at " + HostActionValidator.describe(plan.wakeAt(), now) + ", by " + by);
            case POWER_CANCEL -> new PushMessage("Power action cancelled", "Scheduled power action cancelled by " + by);
            default -> null;
        };
    }

    // ── Read: list and one ───────────────────────────────────────────────────

    /** A result plus the instant it sorts by. */
    private record Item(HostActionResult result, Instant sortKey) {}

    /** Queued requests and recent results, newest first. Never throws. */
    public HostActionsList list() {
        int offset = zone.getRules().getOffset(clock.instant()).getTotalSeconds();
        String reason = unavailableReason();
        if (reason != null) {
            return new HostActionsList(false, reason, dir.toString(), null, zone.getId(), offset, List.of());
        }

        List<Item> items = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Path file : recentResultFiles()) {
            Item item = readResultFile(file, false);
            if (item != null && seen.add(item.result().id())) items.add(item);
        }
        // A request the host has already answered is shown by its result. The host removes the
        // request when it picks it up, but a list taken mid-pickup can see both.
        for (Item q : queued()) {
            if (seen.add(q.result().id())) items.add(q);
        }
        items.sort(Comparator.comparing(Item::sortKey).reversed());

        return new HostActionsList(true, null, dir.toString(), confirmHostName(), zone.getId(), offset,
                items.stream().map(Item::result).toList());
    }

    /**
     * One action with its output and data.
     *
     * @throws DbWorldException 400 for an id that is not one, 503 without a broker, 404 when there
     *                          is no such request or result
     */
    public HostActionResult get(String id) {
        if (id == null || !ID.matcher(id).matches()) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Not an action id: " + HostActionValidator.quote(id) + ".");
        }
        String reason = unavailableReason();
        if (reason != null) {
            throw new DbWorldException(HttpStatus.SERVICE_UNAVAILABLE, reason);
        }

        // The result is read again last: the host removes the request as it picks it up, and that
        // can happen between the first two reads.
        return byId(resultsDir, id, true)
                .or(() -> byId(requestsDir, id, false))
                .or(() -> byId(resultsDir, id, true))
                .map(Item::result)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND,
                        "No action " + id + " on this server. Results are kept for 14 days."));
    }

    private Optional<Item> byId(Path folder, String id, boolean result) {
        Path file = folder.resolve(id + ".json");
        if (!Files.exists(file)) return Optional.empty();
        return Optional.ofNullable(result ? readResultFile(file, true) : readQueuedFile(file));
    }

    /** The newest result files by modification time, at most {@link #MAX_RESULTS}. */
    private List<Path> recentResultFiles() {
        if (!Files.isDirectory(resultsDir)) return List.of();
        record Stamped(Path path, long modified) {}
        try (Stream<Path> files = Files.list(resultsDir)) {
            return files
                    .filter(p -> FILE_NAME.matcher(p.getFileName().toString()).matches())
                    .map(p -> new Stamped(p, modifiedMillis(p)))
                    .sorted(Comparator.comparingLong(Stamped::modified).reversed())
                    .limit(MAX_RESULTS)
                    .map(Stamped::path)
                    .toList();
        } catch (IOException | UncheckedIOException e) {
            log.debug("Could not list host action results in {}: {}", resultsDir, e.toString());
            return List.of();
        }
    }

    private List<Item> queued() {
        if (!Files.isDirectory(requestsDir)) return List.of();
        List<Path> files;
        try (Stream<Path> listing = Files.list(requestsDir)) {
            files = listing.filter(p -> FILE_NAME.matcher(p.getFileName().toString()).matches()).toList();
        } catch (IOException | UncheckedIOException e) {
            log.debug("Could not list queued host actions in {}: {}", requestsDir, e.toString());
            return List.of();
        }
        List<Item> items = new ArrayList<>(files.size());
        for (Path file : files) {
            Item item = readQueuedFile(file);
            if (item != null) items.add(item);
        }
        return items;
    }

    /** A result file as an item; null when it disappeared before it could be read. */
    private Item readResultFile(Path file, boolean full) {
        String id = idOf(file);
        Instant modified = modifiedInstant(file);
        String json;
        try {
            json = readSmall(file);
        } catch (NoSuchFileException e) {
            return null; // pruned by the host between listing and reading
        } catch (AccessDeniedException e) {
            return new Item(unreadable(id, "The app cannot read this result. Results should be mode 0640, group dbworld."),
                    orEpoch(modified));
        } catch (IOException | RuntimeException e) {
            return new Item(unreadable(id, "Could not read this result: " + firstLine(e.getMessage())), orEpoch(modified));
        }
        HostActionResult result = parseResult(json, id, full);
        return new Item(result, sortKey(result.requestedAt(), modified));
    }

    /** A queued request as an item; null when the host took it before it could be read. */
    private Item readQueuedFile(Path file) {
        String id = idOf(file);
        Instant modified = modifiedInstant(file);
        String json;
        try {
            json = readSmall(file);
        } catch (NoSuchFileException e) {
            return null; // picked up by the host between listing and reading
        } catch (IOException | RuntimeException e) {
            json = null;
        }
        HostActionResult result = parseQueued(json, id, modified);
        return new Item(result, sortKey(result.requestedAt(), modified));
    }

    // ── Parsing ──────────────────────────────────────────────────────────────

    /**
     * A result file's content. {@code full} keeps the output and data; the list leaves them out.
     * Anything the host wrote that this app does not know is passed through or ignored, never fatal.
     */
    HostActionResult parseResult(String json, String fileId, boolean full) {
        JsonNode root = parseObject(json);
        if (root == null) {
            return unreadable(fileId, "This result is not a JSON object, so it cannot be shown.");
        }
        // Not trimmed: leading spaces in the output are alignment.
        String output = rawText(root, "output");
        return new HostActionResult(
                fileId,
                text(root, "action"),
                args(root.get("args")),
                nullIfEmpty(text(root, "requestedBy")),
                nullIfEmpty(text(root, "requestedAt")),
                resultStatus(text(root, "status")),
                nullIfEmpty(text(root, "message")),
                nullIfEmpty(text(root, "startedAt")),
                nullIfEmpty(text(root, "finishedAt")),
                intOrNull(root, "exitCode"),
                full ? output : null,
                full ? plain(root.get("data")) : null,
                !output.isBlank());
    }

    /** A request still in the queue. {@code json} may be null or broken; the id is enough to list it. */
    HostActionResult parseQueued(String json, String fileId, Instant fileModified) {
        JsonNode root = parseObject(json);
        String requestedAt = root == null ? null : nullIfEmpty(text(root, "requestedAt"));
        Instant since = Optional.ofNullable(parseInstant(requestedAt))
                .orElse(fileModified != null ? fileModified : clock.instant());
        long waiting = Math.max(0, clock.instant().getEpochSecond() - since.getEpochSecond());
        String message = waiting >= STUCK_AFTER.toSeconds()
                ? "Not picked up after " + humanDuration(waiting) + ". The host's action broker may not be running."
                : "Waiting for the host to pick this up.";
        return new HostActionResult(
                fileId,
                root == null ? "" : text(root, "action"),
                root == null ? Map.of() : args(root.get("args")),
                root == null ? null : nullIfEmpty(text(root, "requestedBy")),
                requestedAt,
                "queued",
                message,
                null, null, null, null, null, false);
    }

    // ── Power state ──────────────────────────────────────────────────────────

    /** The host's power.json, or "unavailable" with the reason. Never throws. */
    public HostPowerState power() {
        String where = powerFile.toString();
        if (!Files.isDirectory(dir)) {
            return HostPowerState.unavailable(where, noBrokerReason());
        }
        try {
            String json = readSmall(powerFile);
            return parsePower(json, modifiedInstant(powerFile));
        } catch (NoSuchFileException e) {
            return HostPowerState.unavailable(where,
                    "No power state at " + where + " yet. The host writes it after every power action and every 15 minutes.");
        } catch (AccessDeniedException e) {
            return HostPowerState.unavailable(where,
                    "The power state at " + where + " is not readable by the app's user. It should be mode 0644.");
        } catch (IOException | RuntimeException e) {
            log.debug("Could not read host power state {}: {}", where, e.toString());
            return HostPowerState.unavailable(where,
                    "Could not read the power state at " + where + ": " + firstLine(e.getMessage()));
        }
    }

    HostPowerState parsePower(String json, Instant fileModified) {
        String where = powerFile.toString();
        JsonNode root = parseObject(json);
        if (root == null) {
            return HostPowerState.unavailable(where, "The power state at " + where + " is not a JSON object.");
        }
        String generatedAt = nullIfEmpty(text(root, "generatedAt"));
        Instant generated = Optional.ofNullable(parseInstant(generatedAt)).orElse(fileModified);
        Long age = generated == null ? null : Math.max(0, clock.instant().getEpochSecond() - generated.getEpochSecond());
        return new HostPowerState(true, null, where,
                nullIfEmpty(text(root, "host")),
                generatedAt,
                age,
                scheduled(root.get("scheduled")),
                wakeAlarm(root.get("wakeAlarm")));
    }

    private static Scheduled scheduled(JsonNode node) {
        if (node == null || !node.isObject()) return null;
        String mode = text(node, "mode").toLowerCase(Locale.ROOT);
        String at = nullIfEmpty(text(node, "at"));
        Long epoch = epoch(node, at);
        // An empty object reads as nothing scheduled, the same as null.
        if (mode.isEmpty() && at == null && epoch == null) return null;
        return new Scheduled(mode.isEmpty() ? "unknown" : mode, at, epoch);
    }

    private static WakeAlarm wakeAlarm(JsonNode node) {
        if (node == null || !node.isObject()) return null;
        String at = nullIfEmpty(text(node, "at"));
        Long epoch = epoch(node, at);
        return at == null && epoch == null ? null : new WakeAlarm(at, epoch);
    }

    /** {@code atEpoch} when usable, otherwise worked out from {@code at}. */
    private static Long epoch(JsonNode node, String at) {
        Long epoch = longOrNull(node, "atEpoch");
        if (epoch != null && epoch > 0) return epoch;
        Instant parsed = parseInstant(at);
        return parsed == null ? null : parsed.getEpochSecond();
    }

    // ── Host name and availability ───────────────────────────────────────────

    /**
     * The name an admin must type to confirm a reboot or shutdown: the host the health report
     * came from, else the one in power.json. Asking the Pi itself is the point; this app's own
     * hostname would be a container id in Docker.
     */
    String confirmHostName() {
        try {
            HostHealthReport report = healthService.read();
            if (report != null && report.host() != null && !report.host().isBlank()) {
                return report.host().trim();
            }
        } catch (RuntimeException e) {
            log.debug("Host health unreadable while resolving the host name: {}", e.toString());
        }
        HostPowerState power = power();
        return power.available() && power.host() != null ? power.host().trim() : null;
    }

    /** Null when actions can be queued; otherwise why not, worded for the System Info page. */
    private String unavailableReason() {
        if (!Files.isDirectory(dir)) return noBrokerReason();
        if (!Files.isDirectory(requestsDir)) {
            return "The action broker at " + dir + " has no requests/ folder.";
        }
        if (!Files.isWritable(requestsDir)) {
            return "The app's user cannot write to " + requestsDir
                    + ". It should be group-writable for dbworld, with the app's user in that group.";
        }
        return null;
    }

    private String noBrokerReason() {
        return "No action broker on this server: " + dir + " does not exist.";
    }

    // ── Lenient helpers ──────────────────────────────────────────────────────

    private static String readSmall(Path file) throws IOException {
        long size = Files.size(file);
        if (size > MAX_FILE_BYTES) {
            throw new IOException(file.getFileName() + " is " + size + " bytes, too large to be one of the host's files");
        }
        return Files.readString(file, StandardCharsets.UTF_8);
    }

    /** The JSON object in {@code json}, or null when there is none. */
    private static JsonNode parseObject(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            JsonNode root = MAPPER.readTree(json);
            return root != null && root.isObject() ? root : null;
        } catch (JacksonException e) {
            return null;
        }
    }

    private static HostActionResult unreadable(String id, String reason) {
        return new HostActionResult(id, "", Map.of(), null, null, "unknown", reason,
                null, null, null, null, null, false);
    }

    private static String resultStatus(String raw) {
        String s = raw.toLowerCase(Locale.ROOT);
        return RESULT_STATUSES.contains(s) ? s : "unknown";
    }

    /** Arguments for display: strings stay strings, arrays become lists of strings, the rest is text. */
    private static Map<String, Object> args(JsonNode node) {
        if (node == null || !node.isObject()) return Map.of();
        Map<String, Object> out = new LinkedHashMap<>();
        for (Map.Entry<String, JsonNode> e : node.properties()) {
            JsonNode v = e.getValue();
            if (v == null || v.isNull()) continue;
            if (v.isArray()) {
                List<String> items = new ArrayList<>();
                for (JsonNode item : v.values()) items.add(scalar(item));
                out.put(e.getKey(), items);
            } else {
                out.put(e.getKey(), v.isContainer() ? v.toString() : scalar(v));
            }
        }
        return out;
    }

    private static String scalar(JsonNode v) {
        if (v == null || v.isNull()) return "";
        if (v.isString()) return v.stringValue();
        return v.isContainer() ? v.toString() : v.asString("");
    }

    /** Arbitrary JSON as plain maps and lists, so the web layer serialises it like any other value. */
    private static Object plain(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode()) return null;
        try {
            return MAPPER.treeToValue(node, Object.class);
        } catch (JacksonException e) {
            return null;
        }
    }

    /** A scalar as text, trimmed; "" for missing, null, objects and arrays. */
    private static String text(JsonNode n, String field) {
        return rawText(n, field).trim();
    }

    private static String rawText(JsonNode n, String field) {
        JsonNode v = n.get(field);
        if (v == null || v.isNull() || v.isContainer()) return "";
        String s = v.isString() ? v.stringValue() : v.asString("");
        return s == null ? "" : s;
    }

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

    private static Integer intOrNull(JsonNode n, String field) {
        Long v = longOrNull(n, field);
        return v == null ? null : (int) Math.max(Integer.MIN_VALUE, Math.min(Integer.MAX_VALUE, v));
    }

    private static String nullIfEmpty(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

    private static Instant parseInstant(String iso) {
        if (iso == null || iso.isBlank()) return null;
        try {
            return OffsetDateTime.parse(iso.trim()).toInstant();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static Instant sortKey(String requestedAt, Instant fileModified) {
        Instant at = parseInstant(requestedAt);
        return at != null ? at : orEpoch(fileModified);
    }

    private static Instant orEpoch(Instant instant) {
        return instant != null ? instant : Instant.EPOCH;
    }

    private static String idOf(Path file) {
        String name = file.getFileName().toString();
        return name.endsWith(".json") ? name.substring(0, name.length() - 5) : name;
    }

    private static Instant modifiedInstant(Path file) {
        try {
            return Files.getLastModifiedTime(file).toInstant();
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }

    private static long modifiedMillis(Path file) {
        Instant modified = modifiedInstant(file);
        return modified == null ? 0 : modified.toEpochMilli();
    }

    private static void deleteQuietly(Path file) {
        try {
            Files.deleteIfExists(file);
        } catch (IOException | RuntimeException ignored) {
            // Best effort: the host ignores dot-files, so a leftover temp file is clutter, not a request.
        }
    }

    static String humanDuration(long seconds) {
        if (seconds < 60) return seconds + " s";
        long minutes = seconds / 60;
        if (minutes < 60) return minutes + " min";
        long hours = minutes / 60;
        return hours < 48 ? hours + " h" : (hours / 24) + " days";
    }

    private static String firstLine(String message) {
        if (message == null || message.isBlank()) return "unknown error";
        int nl = message.indexOf('\n');
        return (nl < 0 ? message : message.substring(0, nl)).trim();
    }
}
