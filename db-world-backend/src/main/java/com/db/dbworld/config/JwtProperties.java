package com.db.dbworld.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(
        String publicKey,
        String privateKey,
        String publicKeyPath,
        String privateKeyPath,
        Duration accessTokenTtl,
        Duration refreshTokenTtl,
        // Refresh-cookie attributes. Defaults (Secure + SameSite=None) make the cookie
        // flow from any WebView/SPA origin over HTTPS; the local profile overrides these
        // to Secure=false / SameSite=Lax so it still works on a plain-http dev server.
        Boolean refreshCookieSecure,
        String refreshCookieSameSite
) {
    public boolean cookieSecure() {
        return refreshCookieSecure == null || refreshCookieSecure; // default true
    }

    public String cookieSameSite() {
        return (refreshCookieSameSite == null || refreshCookieSameSite.isBlank())
                ? "None" : refreshCookieSameSite; // default None
    }
}
