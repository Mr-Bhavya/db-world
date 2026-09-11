package com.db.dbworld.app.ipo.notification;

import com.db.dbworld.app.ipo.entity.IpoChangeEventEntity;

import java.util.Set;

/**
 * A notification-worthy transition detected while ingesting one IPO, produced by
 * {@code IpoIngestService.ingest(...)} and handed to {@link IpoNotificationService} to broadcast.
 * Deliberately narrower than the full change-event trail (which the admin feed keeps): only the
 * lifecycle moments users care about become one of these. {@code oldValue}/{@code newValue} carry
 * the raw values for the kinds that need them (currently GMP, for the threshold check).
 */
public record IpoLifecycleChange(String ipoId, String companyName, Kind kind, String oldValue, String newValue) {

    public enum Kind { OPENED, LISTED, ALLOTMENT, GMP_JUMP }

    /** Change-event types that can carry a user-facing push — the query filter for pending delivery. */
    public static final Set<String> NOTIFIABLE_EVENT_TYPES = Set.of("STATUS", "ALLOTMENT", "GMP");

    private static final String STATUS_OPEN = "open";
    private static final String STATUS_LISTED = "listed";

    public static IpoLifecycleChange of(String ipoId, String companyName, Kind kind) {
        return new IpoLifecycleChange(ipoId, companyName, kind, null, null);
    }

    /**
     * Maps one persisted change event to the lifecycle moment it announces, or {@code null} when it
     * isn't one users hear about — a status change to closed/upcoming, or an event type that only
     * belongs in the admin feed. A {@code null} return still counts as handled by the caller (the
     * event gets stamped so it doesn't sit in the pending queue forever).
     */
    public static IpoLifecycleChange fromEvent(IpoChangeEventEntity event, String companyName) {
        return switch (event.getEventType()) {
            case "STATUS" -> {
                if (STATUS_OPEN.equals(event.getNewValue())) {
                    yield of(event.getIpoId(), companyName, Kind.OPENED);
                } else if (STATUS_LISTED.equals(event.getNewValue())) {
                    yield of(event.getIpoId(), companyName, Kind.LISTED);
                }
                yield null;
            }
            case "ALLOTMENT" -> of(event.getIpoId(), companyName, Kind.ALLOTMENT);
            case "GMP" -> new IpoLifecycleChange(event.getIpoId(), companyName, Kind.GMP_JUMP,
                    event.getOldValue(), event.getNewValue());
            default -> null;
        };
    }
}
