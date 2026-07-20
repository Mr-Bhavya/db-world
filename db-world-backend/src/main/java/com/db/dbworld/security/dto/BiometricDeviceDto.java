package com.db.dbworld.security.dto;

import java.time.Instant;

/** A user's enrolled biometric device, for the device-management UI. */
public record BiometricDeviceDto(
        String deviceId,
        String deviceLabel,
        Instant created,
        Instant lastUsed,
        Instant expiry
) {}
