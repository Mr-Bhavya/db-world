package com.db.dbworld.security.dto;

import jakarta.validation.constraints.NotBlank;

/** Body for POST /api/auth/biometric/enroll (authenticated). */
public record BiometricEnrollRequest(
        @NotBlank String deviceId,
        String deviceLabel
) {}
