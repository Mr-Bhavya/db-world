package com.db.dbworld.app.system.actions.dto;

import java.util.List;

/**
 * Recent actions, plus what the admin UI needs to offer new ones.
 *
 * <p>{@code available} is false where there is no broker (every dev box); {@code reason} then
 * says why and the UI shows a note instead of buttons.
 *
 * @param available        the actions directory and its request queue exist
 * @param reason           why actions are unavailable; null when available
 * @param dir              where this server looks for the broker
 * @param host             the name an admin must type to confirm a reboot or shutdown; null
 *                         when neither the health report nor the power state names the host
 * @param zone             the Pi's time zone; typed times are read in it
 * @param utcOffsetSeconds that zone's current offset, so the UI can show "at 04:30" in Pi time
 *                         without a time-zone library
 * @param items            queued requests and recent results, newest first
 */
public record HostActionsList(
        boolean available,
        String reason,
        String dir,
        String host,
        String zone,
        int utcOffsetSeconds,
        List<HostActionResult> items
) {}
