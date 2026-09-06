package com.db.dbworld.security.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * @param idToken the Google ID token obtained on the client. Verified server-side against
 *                Google's JWKS — never trusted as-is, and never decoded without checking the
 *                signature and audience first.
 */
public record GoogleSignInRequest(@NotBlank String idToken) {}
