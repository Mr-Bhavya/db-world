package com.db.dbworld.app.media.aria2;

import java.util.Map;

/**
 * Human-readable descriptions for aria2 exit/error codes
 * (see the "EXIT STATUS" section of the aria2c manual).
 */
public final class Aria2ErrorCodes {

    private Aria2ErrorCodes() {}

    private static final Map<Integer, String> DESCRIPTIONS = Map.ofEntries(
            Map.entry(1, "Unknown download error"),
            Map.entry(2, "Connection timed out"),
            Map.entry(3, "File not found on the server (404)"),
            Map.entry(4, "File not found — too many 'not found' responses"),
            Map.entry(5, "Download too slow — aborted by the lowest-speed limit"),
            Map.entry(6, "Network problem"),
            Map.entry(7, "Download stopped before finishing"),
            Map.entry(8, "Server does not support resuming this download"),
            Map.entry(9, "Not enough disk space"),
            Map.entry(10, "Piece length differs from the saved control file"),
            Map.entry(11, "The same file is already being downloaded"),
            Map.entry(12, "The same torrent is already being downloaded"),
            Map.entry(13, "File already exists in the download folder"),
            Map.entry(14, "Could not rename the downloaded file"),
            Map.entry(15, "Could not open the existing file"),
            Map.entry(16, "Could not create or truncate the file"),
            Map.entry(17, "File I/O error"),
            Map.entry(18, "Could not create the download folder"),
            Map.entry(19, "Host name could not be resolved"),
            Map.entry(20, "Could not parse the metalink"),
            Map.entry(21, "FTP command failed"),
            Map.entry(22, "Unexpected HTTP response from the server"),
            Map.entry(23, "Too many redirects"),
            Map.entry(24, "Authorization failed — check the username/password"),
            Map.entry(25, "Could not parse the torrent file"),
            Map.entry(26, "The torrent file is corrupted"),
            Map.entry(27, "Invalid magnet link"),
            Map.entry(28, "Invalid download option"),
            Map.entry(29, "Server is overloaded or under maintenance"),
            Map.entry(30, "Could not parse the RPC request"),
            Map.entry(32, "Checksum validation failed")
    );

    /** Friendly message, keeping aria2's own text for detail when it adds something. */
    public static String describe(Integer code, String rawMessage) {
        String raw = rawMessage == null || rawMessage.isBlank() ? null : rawMessage.trim();
        String friendly = code == null ? null : DESCRIPTIONS.get(code);
        if (friendly == null && raw == null) {
            return code == null ? "Download failed (aria2 gave no reason)" : "Download failed (aria2 error " + code + ")";
        }
        if (friendly == null) return raw;
        return raw == null ? friendly + " (aria2 error " + code + ")" : friendly + " — " + raw;
    }
}
