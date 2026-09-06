package com.db.dbworld.security.google;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * Google Sign-In configuration.
 *
 * @param clientIds every OAuth client id that may appear in an ID token's {@code aud} claim.
 *                  This is a LIST because Google issues a separate client id per platform —
 *                  web, Android (bound to the release keystore's SHA-1) and iOS — and a token
 *                  minted for the Android client legitimately carries the Android id. Accepting
 *                  only one would make the feature work on exactly one platform.
 * @param jwkSetUri where Google publishes the keys its ID tokens are signed with.
 * @param issuers   accepted {@code iss} values. Google uses both spellings interchangeably.
 */
@ConfigurationProperties(prefix = "google.auth")
public record GoogleAuthProperties(
        List<String> clientIds,
        String jwkSetUri,
        List<String> issuers
) {
    private static final String DEFAULT_JWK_SET_URI = "https://www.googleapis.com/oauth2/v3/certs";
    private static final List<String> DEFAULT_ISSUERS =
            List.of("https://accounts.google.com", "accounts.google.com");

    public String resolvedJwkSetUri() {
        return (jwkSetUri == null || jwkSetUri.isBlank()) ? DEFAULT_JWK_SET_URI : jwkSetUri;
    }

    public List<String> resolvedIssuers() {
        return (issuers == null || issuers.isEmpty()) ? DEFAULT_ISSUERS : issuers;
    }

    public List<String> resolvedClientIds() {
        return clientIds == null ? List.of() : clientIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .toList();
    }

    /** Google Sign-In is only offered when at least one client id is configured. */
    public boolean isEnabled() {
        return !resolvedClientIds().isEmpty();
    }
}
