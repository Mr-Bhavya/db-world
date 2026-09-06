package com.db.dbworld.core.user.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Confirmation payload for self-service account deletion.
 *
 * @param password     the caller's current password. Optional only for a Google-only account,
 *                     which has none — those are confirmed by the email alone.
 * @param confirmEmail the account's own email, typed back. Deliberate friction: it makes an
 *                     accidental or shoulder-surfed deletion of the wallet and vault much harder.
 */
public record DeleteAccountRequest(
        String password,
        @NotBlank String confirmEmail
) {}
