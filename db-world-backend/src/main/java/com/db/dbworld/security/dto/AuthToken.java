package com.db.dbworld.security.dto;

import com.db.dbworld.core.user.dto.UserDto;

import java.time.Duration;
import java.util.UUID;

/**
 * A freshly minted session.
 *
 * @param familyId groups this token with its rotation successors. It, not the token value,
 *                 is the stable id of "this session" — the token changes on every refresh,
 *                 so revoking a device has to target the family.
 */
public record AuthToken(
        String accessToken,
        String refreshToken,
        UUID familyId,
        Duration refreshTokenTtl,
        UserDto user
) {}
