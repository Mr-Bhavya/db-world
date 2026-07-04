package com.db.dbworld.audit.tracking.parse;

import com.db.dbworld.audit.tracking.enums.ClientApp;
import com.db.dbworld.audit.tracking.enums.TrackChannel;

import java.util.Locale;

/** Maps a User-Agent string to a {@link ClientApp} and derives its {@link TrackChannel}. */
public final class ClientAppDetector {

    private ClientAppDetector() {}

    public static ClientApp detect(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) return ClientApp.UNKNOWN;
        String ua = userAgent.toLowerCase(Locale.ROOT);

        if (ua.contains("aria2"))                         return ClientApp.ARIA2;
        if (ua.contains("internet download manager")
                || ua.contains("idm/") || ua.contains("idman")) return ClientApp.IDM;
        if (ua.contains("1dm") || ua.contains("adm/"))    return ClientApp.ONEDM;
        if (ua.contains("vlc"))                           return ClientApp.VLC;
        if (ua.contains("mpv"))                           return ClientApp.MPV;
        if (ua.contains("kodi") || ua.contains("xbmc"))   return ClientApp.KODI;
        if (ua.contains("wget"))                          return ClientApp.WGET;
        if (ua.contains("curl"))                          return ClientApp.CURL;
        // Browsers — order matters (Edge/Chrome/Safari all overlap).
        if (ua.contains("edg/") || ua.contains("edga") || ua.contains("edgios")) return ClientApp.EDGE;
        if (ua.contains("firefox") || ua.contains("fxios")) return ClientApp.FIREFOX;
        if (ua.contains("chrome") || ua.contains("crios")) return ClientApp.CHROME;
        if (ua.contains("safari"))                        return ClientApp.SAFARI;
        return ClientApp.UNKNOWN;
    }

    public static TrackChannel channel(ClientApp app, boolean selfDeclaredDbworldApp) {
        if (selfDeclaredDbworldApp || app == ClientApp.DBWORLD_APP) return TrackChannel.APP;
        return switch (app) {
            case CHROME, FIREFOX, SAFARI, EDGE -> TrackChannel.BROWSER;
            case UNKNOWN                        -> TrackChannel.EXTERNAL;
            default                             -> TrackChannel.EXTERNAL; // IDM, 1DM, aria2 (not self-declared), VLC…
        };
    }
}
