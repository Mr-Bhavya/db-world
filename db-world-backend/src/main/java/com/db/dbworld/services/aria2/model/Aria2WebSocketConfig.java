package com.db.dbworld.services.aria2.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
public class Aria2WebSocketConfig {
    public static final int RECONNECT_DELAY_MS = 5000;
    public static final int MAX_RECONNECT_ATTEMPTS = 10;
    public static final int STATUS_POLL_INTERVAL_MS = 2000;
    public static final long INACTIVITY_TIMEOUT_MS = 5 * 60 * 60 * 1000; // 5 hours

    public static final List<String> STATUS_POLL_KEYS = List.of(
            "gid", "status", "totalLength", "completedLength", "uploadLength",
            "downloadSpeed", "uploadSpeed", "connections", "numSeeders",
            "errorMessage", "files", "bittorrent", "errorCode", "fileName",
            "path", "eta"
    );
}
