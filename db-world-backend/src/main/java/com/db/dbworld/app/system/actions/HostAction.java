package com.db.dbworld.app.system.actions;

import java.util.Arrays;
import java.util.Optional;
import java.util.Set;

/**
 * The actions the host's broker accepts, by their wire name.
 *
 * <p>This is the app's copy of the host's allowlist. The host checks every request again, so a
 * mismatch can only make the app refuse something the host would have run, never the other way
 * round.
 */
public enum HostAction {
    DOCTOR("doctor"),
    BACKUP_START("backup-start"),
    BACKUP_VERIFY("backup-verify"),
    CLEANUP_PREVIEW("cleanup-preview"),
    CLEANUP_APPLY("cleanup-apply", "categories", "temp"),
    SERVICE_RESTART("service-restart", "service"),
    POWER_REBOOT("power-reboot", "when"),
    POWER_SHUTDOWN("power-shutdown", "when", "wake"),
    POWER_CANCEL("power-cancel"),
    POWER_STATUS("power-status");

    private final String wire;
    private final Set<String> argNames;

    HostAction(String wire, String... argNames) {
        this.wire = wire;
        this.argNames = Set.of(argNames);
    }

    /** The name in request and result files, e.g. {@code power-reboot}. */
    public String wire() {
        return wire;
    }

    /** The only argument names this action takes. Anything else is refused rather than ignored. */
    public Set<String> argNames() {
        return argNames;
    }

    /** Exact match on the wire name; case is not folded, because the host does not fold it either. */
    public static Optional<HostAction> fromWire(String name) {
        if (name == null) return Optional.empty();
        return Arrays.stream(values()).filter(a -> a.wire.equals(name)).findFirst();
    }

    /** Every {@code power-*} action. Only one of these may be waiting in the queue at a time. */
    public boolean isPower() {
        return wire.startsWith("power-");
    }

    /** Takes the machine down, so the admin has to type the host name to confirm. */
    public boolean needsHostConfirm() {
        return this == POWER_REBOOT || this == POWER_SHUTDOWN;
    }

    /** Changes what the machine will do next, so every admin's phone hears about it. */
    public boolean announcesToAdmins() {
        return this == POWER_REBOOT || this == POWER_SHUTDOWN || this == POWER_CANCEL;
    }
}
