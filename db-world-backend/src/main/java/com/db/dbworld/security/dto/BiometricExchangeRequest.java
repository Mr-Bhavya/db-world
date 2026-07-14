package com.db.dbworld.security.dto;

import jakarta.validation.constraints.NotBlank;

/** Body for POST /api/auth/biometric/exchange (public — no bearer token). */
public record BiometricExchangeRequest(
        @NotBlank String deviceToken
) {}
