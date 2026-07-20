package com.db.dbworld.utils;

import org.springframework.http.ResponseCookie;

import java.time.Duration;

public class CookieUtil {

    /**
     * Builds the refresh-token cookie. {@code secure} + {@code sameSite} are supplied by
     * config so the cookie can be {@code SameSite=None; Secure} in production (flows from
     * any WebView/SPA origin) yet {@code SameSite=Lax; Secure=false} on a plain-http dev
     * server. The clearing cookie MUST reuse the same attributes or the browser won't
     * match and remove it — see {@link #clearRefreshCookie}.
     */
    public static ResponseCookie refreshCookie(final String name, final String value,
                                               final Duration duration,
                                               final boolean secure, final String sameSite) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite(sameSite)
                .path("/")
                .maxAge(duration)
                .build();
    }

    /** Expiry cookie matching {@link #refreshCookie}'s attributes so logout actually clears it. */
    public static ResponseCookie clearRefreshCookie(final String name,
                                                    final boolean secure, final String sameSite) {
        return ResponseCookie.from(name, "")
                .httpOnly(true)
                .secure(secure)
                .sameSite(sameSite)
                .path("/")
                .maxAge(0)
                .build();
    }

}
