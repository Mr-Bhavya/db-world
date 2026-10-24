package com.db.dbworld.app.system.health.dto;

import java.util.List;

/**
 * The host health report as the admin UI sees it: the fields of {@code doctor.json} (schema v1)
 * plus what this app worked out about the file itself.
 *
 * <p>{@code available} is false when there is no usable file at all (missing, unreadable, not
 * JSON); {@code reason} then says which, and the report fields are empty. {@code stale} is about
 * an otherwise good file that has stopped being refreshed — its checks are still returned so the
 * page can show the last known state, but they describe the past.
 *
 * @param available        a report was found and parsed
 * @param reason           why it is unavailable; null when available
 * @param stale            the report is older than two intervals plus a minute's grace
 * @param ageSeconds       seconds since the report was generated; null when unavailable
 * @param reportPath       where this server looks for the report, so "not available" can say where
 * @param version          schema version written by the doctor
 * @param host             hostname of the machine that ran the checks
 * @param generatedAt      ISO-8601 time of the run, as written (keeps the host's own offset)
 * @param generatedAtEpoch the same instant in epoch seconds
 * @param intervalSeconds  how often the doctor runs; staleness is measured against this
 * @param overall          worst status across the checks: ok | warn | fail | unknown
 * @param counts           checks per status
 * @param checks           the checks, in the order the doctor wrote them
 */
public record HostHealthReport(
        boolean available,
        String reason,
        boolean stale,
        Long ageSeconds,
        String reportPath,
        Integer version,
        String host,
        String generatedAt,
        Long generatedAtEpoch,
        Long intervalSeconds,
        String overall,
        Counts counts,
        List<Check> checks
) {

    /** No usable report. The UI renders {@code reason}; nothing here should be alerted on as a check. */
    public static HostHealthReport unavailable(String reportPath, String reason) {
        return new HostHealthReport(false, reason, false, null, reportPath,
                null, null, null, null, null, "unknown", Counts.ZERO, List.of());
    }

    /** How many checks are in each state. */
    public record Counts(int ok, int warn, int fail, int unknown) {
        public static final Counts ZERO = new Counts(0, 0, 0, 0);
    }

    /**
     * One check. {@code id} is stable and dotted ({@code disk.root}, {@code smart.hdd}) and is
     * what alerting keys on; {@code name} is for people. {@code detail} and {@code hint} are
     * empty strings rather than null when the doctor had nothing to say.
     */
    public record Check(
            String id,
            String group,
            String name,
            String status,
            String value,
            String detail,
            String hint
    ) {}
}
