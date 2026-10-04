package com.db.dbworld.app.system.actions.dto;

/**
 * The host's {@code power.json}: whether a reboot or shutdown is scheduled and whether the RTC
 * wake alarm is set. The host refreshes it after every power action and every 15 minutes.
 *
 * @param available   the file was found and parsed
 * @param reason      why it is unavailable; null when available
 * @param path        where this server looks for it
 * @param host        hostname written by the host
 * @param generatedAt ISO-8601 time the host wrote it, as written
 * @param ageSeconds  seconds since then (file time when the host gave none); null when unavailable
 * @param scheduled   the pending reboot or shutdown, or null
 * @param wakeAlarm   the pending RTC wake, or null
 */
public record HostPowerState(
        boolean available,
        String reason,
        String path,
        String host,
        String generatedAt,
        Long ageSeconds,
        Scheduled scheduled,
        WakeAlarm wakeAlarm
) {

    public static HostPowerState unavailable(String path, String reason) {
        return new HostPowerState(false, reason, path, null, null, null, null, null);
    }

    /**
     * @param mode    reboot | halt | poweroff, lower-cased; anything else is passed through
     * @param at      ISO-8601 as written; may be null when only the epoch was given
     * @param atEpoch epoch seconds; worked out from {@code at} when the host gave none
     */
    public record Scheduled(String mode, String at, Long atEpoch) {}

    /**
     * @param at      ISO-8601 as written
     * @param atEpoch epoch seconds; worked out from {@code at} when the host gave none
     */
    public record WakeAlarm(String at, Long atEpoch) {}
}
