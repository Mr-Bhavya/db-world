package com.db.dbworld.core.user.dto;

public record UserSearchResponse(
        Long userId,
        String fullName,
        String email
) {}
