package com.db.dbworld.app.ipo.notification;

/**
 * A notification-worthy transition detected while ingesting one IPO, produced by
 * {@code IpoIngestService.ingest(...)} and handed to {@link IpoNotificationService} to broadcast.
 * Deliberately narrower than the full change-event trail (which the admin feed keeps): only the
 * lifecycle moments users care about become one of these. {@code oldValue}/{@code newValue} carry
 * the raw values for the kinds that need them (currently GMP, for the threshold check).
 */
public record IpoLifecycleChange(String ipoId, String companyName, Kind kind, String oldValue, String newValue) {

    public enum Kind { OPENED, LISTED, ALLOTMENT, GMP_JUMP }

    public static IpoLifecycleChange of(String ipoId, String companyName, Kind kind) {
        return new IpoLifecycleChange(ipoId, companyName, kind, null, null);
    }
}
