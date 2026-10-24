package com.db.dbworld.app.system.actions;

import com.db.dbworld.core.exception.DbWorldException;
import org.springframework.http.HttpStatus;

import java.time.Clock;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Checks a request against the broker's rules before it is written to the queue.
 *
 * <p>The host validates every request again as root, so this is defence in depth, not the gate.
 * It is still worth doing properly: a bad request refused here comes back to the admin at once as
 * a readable 400, instead of as a "rejected" result a second later, and nothing malformed ever
 * reaches a root process through this app.
 *
 * <p>The rules mirror the host's table exactly. Where this class is stricter (control characters
 * in a folder name) it is because those values would also be written to the app log.
 */
final class HostActionValidator {

    /** The services the host lets the app restart, in the order the UI lists them. */
    static final List<String> SERVICES = List.of("nginx", "redis-server", "aria2", "smbd");

    /** Cleanup categories {@code cleanup-apply} accepts. Ingestion leftovers go in {@code temp} instead. */
    static final List<String> CLEANUP_CATEGORIES = List.of("journal", "apt", "logs", "runner", "snap", "artefacts");

    static final int REBOOT_DELAY_MIN_MINUTES = 1;
    static final int REBOOT_DELAY_MAX_MINUTES = 1440;
    static final int WAKE_MIN_MINUTES = 5;
    static final int WAKE_MAX_MINUTES = 10080;
    static final Duration MIN_WAKE_GAP = Duration.ofMinutes(5);
    static final int MAX_TEMP_NAME_LENGTH = 255;

    /** {@code +N}. Capped at six digits so a silly value is a range error, not an overflow. */
    private static final Pattern IN_MINUTES = Pattern.compile("\\+(\\d{1,6})");
    /** {@code HH:MM} on the 24-hour clock, two digits each, as the host expects. */
    private static final Pattern CLOCK = Pattern.compile("([01]\\d|2[0-3]):([0-5]\\d)");
    /** {@code YYYY-MM-DDTHH:MM}; whether it is a real date is checked by parsing. */
    private static final Pattern LOCAL_DATE_TIME = Pattern.compile("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}");

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm", Locale.ENGLISH);

    private final Clock clock;
    private final ZoneId zone;

    HostActionValidator(Clock clock, ZoneId zone) {
        this.clock = clock;
        this.zone = zone;
    }

    /**
     * A request that passed: the action, its arguments trimmed and de-duplicated in the form they
     * will be written, the confirm text, and for power actions when they take effect.
     */
    record Validated(HostAction action, Map<String, Object> args, String confirm, PowerPlan plan) {}

    /**
     * When a reboot or shutdown happens and, for a shutdown, when the Pi wakes, both in the Pi's
     * zone. Only used to word the push to admins; the request itself carries the admin's own
     * {@code when}/{@code wake} strings, which is what the host acts on.
     */
    record PowerPlan(ZonedDateTime at, boolean immediate, ZonedDateTime wakeAt) {}

    /**
     * @param hostName the name {@code confirm} must equal for reboot and shutdown; asked for only
     *                 when one of those is being validated, and null when the host is not known
     * @throws DbWorldException 400 with a readable message when the request breaks a rule; 409
     *                          when a power action cannot be confirmed because the host name is unknown
     */
    Validated validate(String actionName, Map<String, ?> rawArgs, String confirm, Supplier<String> hostName) {
        if (actionName == null || actionName.isBlank()) {
            throw invalid("Say which action to run.");
        }
        HostAction action = HostAction.fromWire(actionName.trim())
                .orElseThrow(() -> invalid("Unknown action " + quote(actionName) + "."));

        Map<String, ?> args = rawArgs == null ? Map.of() : rawArgs;
        checkShapes(action, args);

        Map<String, Object> normalised = new LinkedHashMap<>();
        PowerPlan plan = null;
        switch (action) {
            case DOCTOR, BACKUP_START, BACKUP_VERIFY, CLEANUP_PREVIEW, POWER_CANCEL, POWER_STATUS -> {
                // No arguments; checkShapes has already refused any.
            }
            case SERVICE_RESTART -> {
                String service = requiredString(args, "service", "Say which service to restart.");
                if (!SERVICES.contains(service)) {
                    throw invalid("Only " + String.join(", ", SERVICES) + " can be restarted, not " + quote(service) + ".");
                }
                normalised.put("service", service);
            }
            case CLEANUP_APPLY -> {
                List<String> categories = categories(args);
                List<String> temp = tempNames(args);
                if (categories.isEmpty() && temp.isEmpty()) {
                    throw invalid("Pick at least one thing to clean up.");
                }
                // Both lists are always written, empty or not, so the host never has to tell a
                // missing key from an empty one.
                normalised.put("categories", categories);
                normalised.put("temp", temp);
            }
            case POWER_REBOOT -> {
                String when = requiredString(args, "when", "Say when to reboot: now, +N minutes or HH:MM.");
                ZonedDateTime now = now();
                ZonedDateTime at = resolveWhen(when, now);
                normalised.put("when", when);
                plan = new PowerPlan(at, "now".equals(when), null);
            }
            case POWER_SHUTDOWN -> {
                String when = requiredString(args, "when", "Say when to shut down: now, +N minutes or HH:MM.");
                // A Pi that is shut down stays down until someone pulls the plug. Waking itself on
                // the RTC alarm is the only way back that needs no one on site, so it is mandatory.
                String wake = requiredString(args, "wake",
                        "A shutdown needs a wake time. Without one the Pi stays off until someone power-cycles it.");
                ZonedDateTime now = now();
                ZonedDateTime at = resolveWhen(when, now);
                ZonedDateTime wakeAt = resolveWake(wake, now);
                if (wakeAt.isBefore(at.plus(MIN_WAKE_GAP))) {
                    throw invalid("The wake time (" + describe(wakeAt, now) + ") must be at least "
                            + MIN_WAKE_GAP.toMinutes() + " minutes after the shutdown (" + describe(at, now) + ").");
                }
                normalised.put("when", when);
                normalised.put("wake", wake);
                plan = new PowerPlan(at, "now".equals(when), wakeAt);
            }
        }

        String typed = confirm == null ? "" : confirm.trim();
        if (action.needsHostConfirm()) {
            String host = hostName == null ? null : hostName.get();
            if (host == null || host.isBlank()) {
                throw new DbWorldException(HttpStatus.CONFLICT,
                        "The host name is not known yet (no health report and no power state), so a "
                                + action.wire() + " cannot be confirmed. Run the health check first.");
            }
            if (!host.trim().equals(typed)) {
                throw invalid("Type the host name " + quote(host.trim()) + " exactly to confirm.");
            }
        }
        return new Validated(action, normalised, typed, plan);
    }

    // ── Times ────────────────────────────────────────────────────────────────

    /** {@code now}, {@code +N} minutes (1–1440) or the next {@code HH:MM}, in the Pi's zone. */
    ZonedDateTime resolveWhen(String when, ZonedDateTime now) {
        if ("now".equals(when)) return now;

        Matcher minutes = IN_MINUTES.matcher(when);
        if (minutes.matches()) {
            int n = Integer.parseInt(minutes.group(1));
            if (n < REBOOT_DELAY_MIN_MINUTES || n > REBOOT_DELAY_MAX_MINUTES) {
                throw invalid("'when' in minutes must be between " + REBOOT_DELAY_MIN_MINUTES + " and "
                        + REBOOT_DELAY_MAX_MINUTES + " (a day), not " + n + ".");
            }
            return now.plusMinutes(n);
        }

        Matcher clockTime = CLOCK.matcher(when);
        if (clockTime.matches()) {
            LocalTime time = LocalTime.of(Integer.parseInt(clockTime.group(1)), Integer.parseInt(clockTime.group(2)));
            ZonedDateTime today = ZonedDateTime.of(now.toLocalDate(), time, zone);
            // "The next 04:30": a time that has already passed today, or is this very minute,
            // means tomorrow, which is also what shutdown(8) does with HH:MM.
            return today.isAfter(now) ? today : ZonedDateTime.of(now.toLocalDate().plusDays(1), time, zone);
        }

        throw invalid("'when' must be now, +N (minutes from now) or HH:MM (24-hour clock), not " + quote(when) + ".");
    }

    /** {@code +N} minutes (5–10080) or {@code YYYY-MM-DDTHH:MM} in the Pi's local time. */
    ZonedDateTime resolveWake(String wake, ZonedDateTime now) {
        Matcher minutes = IN_MINUTES.matcher(wake);
        if (minutes.matches()) {
            int n = Integer.parseInt(minutes.group(1));
            if (n < WAKE_MIN_MINUTES || n > WAKE_MAX_MINUTES) {
                throw invalid("'wake' in minutes must be between " + WAKE_MIN_MINUTES + " and "
                        + WAKE_MAX_MINUTES + " (a week), not " + n + ".");
            }
            return now.plusMinutes(n);
        }

        if (LOCAL_DATE_TIME.matcher(wake).matches()) {
            ZonedDateTime wakeAt;
            try {
                // ISO_LOCAL_DATE_TIME resolves strictly, so 2026-02-30 or 24:00 is an error, not a
                // quietly rolled-over date.
                wakeAt = LocalDateTime.parse(wake).atZone(zone);
            } catch (DateTimeException e) {
                throw invalid("'wake' is not a real date and time: " + quote(wake) + ".");
            }
            // The same one-week ceiling as +N, and the host enforces it too: a wake date
            // months out is almost always a typo, and the Pi would sit off until then.
            if (wakeAt.isAfter(now.plusMinutes(WAKE_MAX_MINUTES))) {
                throw invalid("'wake' must be within a week from now, not " + quote(wake) + ".");
            }
            return wakeAt;
        }

        throw invalid("'wake' must be +N (minutes from now) or YYYY-MM-DDTHH:MM (the Pi's local time), not "
                + quote(wake) + ".");
    }

    /**
     * "23:00", "06:00 tomorrow" or "Tue 6 Oct 06:00": short enough for a push body, and never
     * ambiguous about the day.
     */
    static String describe(ZonedDateTime t, ZonedDateTime now) {
        String time = HH_MM.format(t);
        if (t.toLocalDate().equals(now.toLocalDate())) return time;
        if (t.toLocalDate().equals(now.toLocalDate().plusDays(1))) return time + " tomorrow";
        return DateTimeFormatter.ofPattern("EEE d MMM", Locale.ENGLISH).format(t) + " " + time;
    }

    private ZonedDateTime now() {
        // Whole seconds: the host works in minutes, and sub-second noise only makes the
        // five-minute wake gap flaky at its edge.
        return ZonedDateTime.now(clock.withZone(zone)).truncatedTo(ChronoUnit.SECONDS);
    }

    // ── Arguments ────────────────────────────────────────────────────────────

    /** Every value a string or a list of strings, and no names the action does not take. */
    private static void checkShapes(HostAction action, Map<String, ?> args) {
        for (Map.Entry<String, ?> e : args.entrySet()) {
            String name = e.getKey();
            if (!action.argNames().contains(name)) {
                throw invalid(action.argNames().isEmpty()
                        ? action.wire() + " takes no arguments, but got " + quote(name) + "."
                        : action.wire() + " has no argument " + quote(name) + ".");
            }
            Object value = e.getValue();
            boolean ok = value instanceof String
                    || (value instanceof List<?> list && list.stream().allMatch(String.class::isInstance));
            if (!ok) {
                throw invalid("Argument " + quote(name) + " must be a string or a list of strings.");
            }
        }
    }

    private static String requiredString(Map<String, ?> args, String name, String whenMissing) {
        Object value = args.get(name);
        if (value == null) throw invalid(whenMissing);
        if (!(value instanceof String s)) throw invalid("Argument " + quote(name) + " must be a string.");
        String trimmed = s.trim();
        if (trimmed.isEmpty()) throw invalid(whenMissing);
        return trimmed;
    }

    private static List<String> optionalList(Map<String, ?> args, String name) {
        Object value = args.get(name);
        if (value == null) return List.of();
        if (!(value instanceof List<?> list)) throw invalid("Argument " + quote(name) + " must be a list.");
        List<String> out = new ArrayList<>(list.size());
        for (Object item : list) out.add(((String) item).trim());
        return out;
    }

    private static List<String> categories(Map<String, ?> args) {
        LinkedHashSet<String> picked = new LinkedHashSet<>();
        for (String c : optionalList(args, "categories")) {
            if (!CLEANUP_CATEGORIES.contains(c)) {
                throw invalid("Unknown cleanup category " + quote(c) + ". Allowed: "
                        + String.join(", ", CLEANUP_CATEGORIES) + ".");
            }
            picked.add(c);
        }
        return List.copyOf(picked);
    }

    private static List<String> tempNames(Map<String, ?> args) {
        LinkedHashSet<String> picked = new LinkedHashSet<>();
        for (String name : optionalList(args, "temp")) {
            if (name.isEmpty() || name.equals(".")) {
                throw invalid("An empty folder name cannot be cleaned up.");
            }
            if (name.length() > MAX_TEMP_NAME_LENGTH) {
                throw invalid("Folder name is longer than " + MAX_TEMP_NAME_LENGTH + " characters: " + quote(name) + ".");
            }
            // A name, never a path: these become arguments to rm under /srv/dbworld/temp as root.
            if (name.contains("/") || name.contains("..")) {
                throw invalid("Folder name must not contain '/' or '..': " + quote(name) + ".");
            }
            if (name.chars().anyMatch(Character::isISOControl)) {
                throw invalid("Folder name must not contain control characters: " + quote(name) + ".");
            }
            picked.add(name);
        }
        return List.copyOf(picked);
    }

    // ── Messages ─────────────────────────────────────────────────────────────

    private static DbWorldException invalid(String message) {
        return new DbWorldException(HttpStatus.BAD_REQUEST, message);
    }

    /**
     * A caller's value as it may appear in an error message, which is also logged: control
     * characters replaced so one value cannot forge log lines, and long values cut short.
     */
    static String quote(String value) {
        if (value == null) return "''";
        String clean = value.codePoints()
                .map(c -> Character.isISOControl(c) ? '?' : c)
                .collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append)
                .toString();
        return "'" + (clean.length() > 80 ? clean.substring(0, 77) + "..." : clean) + "'";
    }
}
