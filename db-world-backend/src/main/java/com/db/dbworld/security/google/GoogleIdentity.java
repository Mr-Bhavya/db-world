package com.db.dbworld.security.google;

/**
 * The verified claims we care about from a Google ID token.
 *
 * @param subject Google's stable per-account identifier. This, not the email, is what an
 *                account is linked to — a Google account can change its email address, and
 *                a released Workspace address can later belong to a different person.
 */
public record GoogleIdentity(
        String subject,
        String email,
        boolean emailVerified,
        String name,
        String givenName,
        String familyName,
        String pictureUrl
) {}
