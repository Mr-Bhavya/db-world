package com.db.dbworld.audit.activity.util;

import com.db.dbworld.audit.activity.entity.UserCinemaActivityEntity.ClientType;

/**
 * Maps a raw HTTP User-Agent string to {@link ClientType}. Detection is intentionally
 * case-insensitive substring matching — User-Agent reporting is famously inconsistent,
 * and a permissive matcher catches the common variants
 * (e.g. {@code aria2/1.36}, {@code Aria2c}, {@code Wget/1.20.3}).
 *
 * <p>Order matters: more specific tools come first so an IDM client that also identifies
 * as Mozilla-compatible still resolves to IDM rather than BROWSER.
 */
public final class UserAgentClassifier {

    private UserAgentClassifier() {}

    public static ClientType classify(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) return ClientType.UNKNOWN;
        String ua = userAgent.toLowerCase();

        // Multi-connection downloaders first — these often impersonate browsers in headers
        if (ua.contains("aria2"))                              return ClientType.ARIA2;
        if (ua.contains("internet download manager") || ua.contains("idmlib")) return ClientType.IDM;
        if (ua.contains("idm/"))                               return ClientType.IDM;
        if (ua.startsWith("wget") || ua.contains(" wget/"))    return ClientType.WGET;
        if (ua.startsWith("curl") || ua.contains(" curl/"))    return ClientType.CURL;

        // Media players that fetch URLs directly
        if (ua.contains("vlc"))                                return ClientType.VLC;
        if (ua.contains("mpv"))                                return ClientType.MPV;
        if (ua.contains("kodi") || ua.contains("xbmc"))        return ClientType.KODI;

        // Mainstream browsers
        if (ua.contains("mozilla") || ua.contains("chrome") || ua.contains("safari")
                || ua.contains("firefox") || ua.contains("edg/") || ua.contains("opera")) {
            return ClientType.BROWSER;
        }
        return ClientType.UNKNOWN;
    }
}
