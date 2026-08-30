package com.db.dbworld.security.dto;

import jakarta.validation.constraints.NotBlank;

/** Starts a password reset. The response is identical whether or not the address exists. */
public record ForgotPasswordRequest(@NotBlank String email) {}
