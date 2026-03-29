package com.db.dbworld.security.dto;

public record CurrentUser(
        Long userId,
        String email,
        String role
) {}
