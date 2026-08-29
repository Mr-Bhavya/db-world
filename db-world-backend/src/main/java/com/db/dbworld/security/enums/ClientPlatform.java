package com.db.dbworld.security.enums;

import java.util.Locale;

/**
 * Which client a session was created from.
 *
 * <p>This drives one behavioural decision, not just a label: {@link #isNative()} clients get
 * the refresh token in the response body (they store it in the Keychain / AndroidKeyStore)
 * because WKWebView's tracking prevention makes a {@code SameSite=None} cookie unreliable on
 * iOS. Web keeps the httpOnly cookie, which is strictly safer where it actually works.
 */
public enum ClientPlatform {
    WEB,
    ANDROID,
    IOS;

    /** Header the frontend sets so the server knows how to hand back the refresh token. */
    public static final String HEADER = "X-Client-Platform";

    /** Lenient parse — an unknown or absent value is treated as WEB, the safer default. */
    public static ClientPlatform from(final String raw) {
        if (raw == null || raw.isBlank()) return WEB;
        try {
            return valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return WEB;
        }
    }

    /** True for app builds, which cannot rely on a cross-site cookie surviving. */
    public boolean isNative() {
        return this != WEB;
    }
}
