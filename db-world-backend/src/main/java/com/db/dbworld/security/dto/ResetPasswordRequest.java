package com.db.dbworld.security.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * @param token    the raw token from the emailed link. Single-use and short-lived.
 * @param password the replacement. Completing this signs the account out everywhere.
 */
public record ResetPasswordRequest(
        @NotBlank String token,
        @NotBlank @Size(min = 6, max = 100) String password
) {}
