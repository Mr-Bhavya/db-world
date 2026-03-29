package com.db.dbworld.app.media.aria2.model;

import java.util.List;

/**
 * Compile-time constants for the Aria2 WebSocket client.
 * Non-instantiable — all members are static.
 */
public final class Aria2WebSocketConfig {

    private Aria2WebSocketConfig() {}

    public static final int  RECONNECT_DELAY_MS      = 5_000;
    public static final int  MAX_RECONNECT_ATTEMPTS   = 10;
    public static final int  STATUS_POLL_INTERVAL_MS  = 2_000;
    public static final long INACTIVITY_TIMEOUT_MS    = 5L * 60 * 60 * 1_000; // 5 hours

    public static final List<String> STATUS_POLL_KEYS = List.of(
            "gid", "status", "totalLength", "completedLength", "uploadLength",
            "downloadSpeed", "uploadSpeed", "connections", "numSeeders",
            "errorMessage", "files", "bittorrent", "errorCode", "eta"
    );
}
