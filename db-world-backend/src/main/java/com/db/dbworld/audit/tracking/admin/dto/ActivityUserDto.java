package com.db.dbworld.audit.tracking.admin.dto;

/**
 * One entry in the "users with activity" dropdown source on the admin Activity
 * console — distinct users who have at least one {@code activity_session} row.
 */
public record ActivityUserDto(
        Long userId,
        String email,
        String firstName,
        String lastName
) {}
