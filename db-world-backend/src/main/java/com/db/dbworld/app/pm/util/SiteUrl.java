package com.db.dbworld.app.pm.util;

import java.net.MalformedURLException;
import java.net.URL;

/** What a vault entry's website means: optional, and "example.com" is as good as "https://example.com". */
public final class SiteUrl {

    private SiteUrl() {}

    /** The URL as saved: with its scheme, or null when there is no website. */
    public static String stored(String url) {
        if (url == null || url.isBlank()) return null;
        String u = url.trim();
        return u.contains("://") ? u : "https://" + u;
    }

    /** The host of a typed website, or null when none was given. */
    public static String hostOf(String url) throws MalformedURLException {
        String stored = stored(url);
        if (stored == null) return null;
        String host = new URL(stored.toLowerCase()).getHost();
        if (host.isBlank()) throw new MalformedURLException("no host in " + url);
        return host;
    }
}
