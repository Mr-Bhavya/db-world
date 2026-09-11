package com.db.dbworld.security.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Connects Google to an existing password account whose email was never verified.
 *
 * <p>The ID token proves the caller owns the mailbox; the password proves they own the local
 * account. Both are needed, because a matching email address on its own proves neither.
 */
public record GoogleLinkRequest(
        @NotBlank String idToken,
        @NotBlank String password
) {}
