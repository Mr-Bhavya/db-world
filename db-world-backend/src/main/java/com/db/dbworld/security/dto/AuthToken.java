package com.db.dbworld.security.dto;

import com.db.dbworld.core.user.dto.UserDto;

import java.time.Duration;

public record AuthToken(
        String accessToken,
        String refreshToken,
        Duration refreshTokenTtl,
        UserDto user
) {}