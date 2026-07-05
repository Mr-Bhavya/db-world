package com.db.dbworld.core.user.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Admin-initiated password reset for another user. Unlike {@link UpdateUserRequest},
 * it carries only the new password so an admin can reset it without re-supplying the
 * user's whole profile (which is what made the old "reset via updateUser" path fail
 * validation).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AdminPasswordRequest {

    @NotEmpty
    @Size(min = 6, max = 100)
    private String password;
}
